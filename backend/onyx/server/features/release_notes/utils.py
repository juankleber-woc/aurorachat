"""Utility functions for AuroraChat release notifications."""

import re
from datetime import datetime
from datetime import timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from onyx import __version__
from onyx.cache.factory import get_shared_cache_backend
from onyx.configs.app_configs import INSTANCE_TYPE
from onyx.configs.constants import OnyxRedisLocks
from onyx.db.release_notes import create_release_notifications_for_versions
from onyx.server.features.release_notes.constants import (
    AUTO_REFRESH_THRESHOLD_SECONDS,
)
from onyx.server.features.release_notes.constants import FETCH_TIMEOUT
from onyx.server.features.release_notes.constants import GITHUB_RELEASES_API_URL
from onyx.server.features.release_notes.constants import REDIS_CACHE_TTL
from onyx.server.features.release_notes.constants import REDIS_KEY_ETAG
from onyx.server.features.release_notes.constants import REDIS_KEY_FETCHED_AT
from onyx.server.features.release_notes.models import ReleaseNoteEntry
from onyx.utils.logger import setup_logger

logger = setup_logger()


def is_valid_version(version: str) -> bool:
    return bool(re.match(r"^v\d+\.\d+\.\d+(-[a-zA-Z]+\.\d+)?$", version))


def parse_version_tuple(version: str) -> tuple[int, int, int]:
    clean = re.sub(r"^v", "", version)
    clean = re.sub(r"-.*$", "", clean)
    parts = clean.split(".")
    return (
        int(parts[0]) if len(parts) > 0 else 0,
        int(parts[1]) if len(parts) > 1 else 0,
        int(parts[2]) if len(parts) > 2 else 0,
    )


def is_version_gt(v1: str, v2: str) -> bool:
    return parse_version_tuple(v1) > parse_version_tuple(v2)


def parse_github_releases_to_entries(
    releases_payload: list[dict[str, Any]],
) -> list[ReleaseNoteEntry]:
    all_entries: list[ReleaseNoteEntry] = []

    for release in releases_payload:
        tag_name = str(release.get("tag_name") or "").strip()
        if (
            not tag_name
            or not is_valid_version(tag_name)
            or release.get("draft")
            or release.get("prerelease")
        ):
            continue

        published_at = str(
            release.get("published_at") or release.get("created_at") or ""
        ).strip()
        html_url = str(release.get("html_url") or "").strip()

        if not html_url:
            continue

        if published_at:
            try:
                parsed_date = datetime.fromisoformat(
                    published_at.replace("Z", "+00:00")
                )
                date = parsed_date.strftime("%Y-%m-%d")
            except ValueError:
                date = published_at
        else:
            date = ""

        all_entries.append(
            ReleaseNoteEntry(
                version=tag_name,
                date=date,
                title=f"AuroraChat {tag_name} is available!",
                link=html_url,
            )
        )

    if not all_entries:
        return []

    if not __version__ or not is_valid_version(__version__):
        return []

    entries = [
        entry for entry in all_entries if is_version_gt(entry.version, __version__)
    ]

    if INSTANCE_TYPE == "cloud":
        return sorted(
            entries, key=lambda x: parse_version_tuple(x.version), reverse=True
        )[:1]

    return entries


def get_cached_etag() -> str | None:
    cache = get_shared_cache_backend()
    try:
        etag = cache.get(REDIS_KEY_ETAG)
        if etag:
            return etag.decode("utf-8")
        return None
    except Exception as e:
        logger.error(f"Failed to get cached etag: {e}")
        return None


def get_last_fetch_time() -> datetime | None:
    cache = get_shared_cache_backend()
    try:
        raw = cache.get(REDIS_KEY_FETCHED_AT)
        if not raw:
            return None

        last_fetch = datetime.fromisoformat(raw.decode("utf-8"))
        if last_fetch.tzinfo is None:
            last_fetch = last_fetch.replace(tzinfo=timezone.utc)
        else:
            last_fetch = last_fetch.astimezone(timezone.utc)

        return last_fetch
    except Exception as e:
        logger.error(f"Failed to get last fetch time from cache: {e}")
        return None


def save_fetch_metadata(etag: str | None) -> None:
    cache = get_shared_cache_backend()
    now = datetime.now(timezone.utc)

    try:
        cache.set(REDIS_KEY_FETCHED_AT, now.isoformat(), ex=REDIS_CACHE_TTL)
        if etag:
            cache.set(REDIS_KEY_ETAG, etag, ex=REDIS_CACHE_TTL)
    except Exception as e:
        logger.error(f"Failed to save fetch metadata to cache: {e}")


def is_cache_stale() -> bool:
    last_fetch = get_last_fetch_time()
    if last_fetch is None:
        return True
    age = datetime.now(timezone.utc) - last_fetch
    return age.total_seconds() > AUTO_REFRESH_THRESHOLD_SECONDS


def ensure_release_notes_fresh_and_notify(db_session: Session) -> None:
    if not is_cache_stale():
        return

    cache = get_shared_cache_backend()
    lock = cache.lock(
        OnyxRedisLocks.RELEASE_NOTES_FETCH_LOCK,
        timeout=90,
    )

    acquired = lock.acquire(blocking=False)
    if not acquired:
        logger.debug("Another request is already fetching release notes, skipping.")
        return

    try:
        logger.debug("Checking GitHub for AuroraChat release updates.")

        headers: dict[str, str] = {
            "Accept": "application/vnd.github+json",
        }
        etag = get_cached_etag()
        if etag:
            headers["If-None-Match"] = etag

        try:
            response = httpx.get(
                GITHUB_RELEASES_API_URL,
                headers=headers,
                timeout=FETCH_TIMEOUT,
                follow_redirects=True,
            )

            if response.status_code == 304:
                logger.debug("Release notes unchanged (304).")
                save_fetch_metadata(etag)
                return

            response.raise_for_status()

            releases = response.json()
            if not isinstance(releases, list):
                raise ValueError("Unexpected GitHub releases response format.")

            entries = parse_github_releases_to_entries(releases)
            new_etag = response.headers.get("ETag")
            save_fetch_metadata(new_etag)

            entries = sorted(entries, key=lambda x: parse_version_tuple(x.version))
            create_release_notifications_for_versions(db_session, entries)

        except Exception as e:
            logger.error(f"Failed to check release notes: {e}")
            save_fetch_metadata(None)
    finally:
        if lock.owned():
            lock.release()
