"use client";

import useSWR from "swr";
import { SWR_KEYS } from "@/lib/swr-keys";
import { useRouter } from "next/navigation";
import { Route } from "next";
import { track, AnalyticsEvent } from "@/lib/analytics";
import { Notification, NotificationType } from "@/interfaces/settings";
import { errorHandlingFetcher } from "@/lib/fetcher";
import Text from "@/refresh-components/texts/Text";
import LineItem from "@/refresh-components/buttons/LineItem";
import { SvgSparkle, SvgRefreshCw, SvgX } from "@opal/icons";
import { IconProps } from "@opal/types";
import { Button } from "@opal/components";
import SimpleLoader from "@/refresh-components/loaders/SimpleLoader";
import { Section } from "@/layouts/general-layouts";
import Separator from "@/refresh-components/Separator";
import { useLocale } from "@/providers/LocaleProvider";

function getNotificationIcon(
  notifType: string
): React.FunctionComponent<IconProps> {
  switch (notifType) {
    case NotificationType.REINDEX:
      return SvgRefreshCw;
    default:
      return SvgSparkle;
  }
}

interface NotificationsPopoverProps {
  onClose: () => void;
  onNavigate: () => void;
  onShowBuildIntro?: () => void;
}

export default function NotificationsPopover({
  onClose,
  onNavigate,
  onShowBuildIntro,
}: NotificationsPopoverProps) {
  const router = useRouter();
  const { t } = useLocale();
  const {
    data: notifications,
    mutate,
    isLoading,
  } = useSWR<Notification[]>(SWR_KEYS.notifications, errorHandlingFetcher);

  const isAllowedNotification = (notification: Notification) => {
    if (notification.notif_type === "two_day_trial_ending") {
      return false;
    }

    if (notification.notif_type === NotificationType.RELEASE_NOTES) {
      return notification.additional_data?.link?.includes(
        "github.com/juankleber-woc/aurorachat/releases/tag/"
      );
    }

    return true;
  };

  const visibleNotifications =
    notifications?.filter((notification) => isAllowedNotification(notification)) ??
    [];

  const getNotificationTitle = (notification: Notification) => {
    if (
      notification.notif_type === NotificationType.RELEASE_NOTES &&
      notification.additional_data?.version
    ) {
      return t("release_available", {
        version: notification.additional_data.version,
      });
    }

    if (
      notification.notif_type === NotificationType.FEATURE_ANNOUNCEMENT &&
      notification.additional_data?.feature === "build_mode"
    ) {
      return t("build_intro_title");
    }

    return notification.title;
  };

  const getNotificationDescription = (notification: Notification) => {
    if (
      notification.notif_type === NotificationType.RELEASE_NOTES &&
      notification.additional_data?.version
    ) {
      return t("release_description", {
        version: notification.additional_data.version,
      });
    }

    if (
      notification.notif_type === NotificationType.FEATURE_ANNOUNCEMENT &&
      notification.additional_data?.feature === "build_mode"
    ) {
      return t("build_intro_description");
    }

    return notification.description ?? undefined;
  };

  const handleNotificationClick = (notification: Notification) => {
    // Handle build_mode feature announcement specially - show intro animation
    if (
      notification.notif_type === NotificationType.FEATURE_ANNOUNCEMENT &&
      notification.additional_data?.feature === "build_mode" &&
      onShowBuildIntro
    ) {
      onNavigate();
      onShowBuildIntro();
      return;
    }

    const link = notification.additional_data?.link;
    if (!link) return;

    // Track release notes clicks
    if (notification.notif_type === NotificationType.RELEASE_NOTES) {
      track(AnalyticsEvent.RELEASE_NOTIFICATION_CLICKED, {
        version: notification.additional_data?.version,
      });
    }

    // External links open in new tab
    if (link.startsWith("http://") || link.startsWith("https://")) {
      if (!notification.dismissed) {
        handleDismiss(notification.id);
      }
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }

    // Relative links navigate internally
    onNavigate();
    router.push(link as Route);
  };

  const handleDismiss = async (
    notificationId: number,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation(); // Prevent triggering the LineItem onClick
    try {
      const response = await fetch(
        `/api/notifications/${notificationId}/dismiss`,
        {
          method: "POST",
        }
      );
      if (response.ok) {
        mutate(); // Refresh the notifications list
      }
    } catch (error) {
      console.error("Error dismissing notification:", error);
    }
  };

  return (
    <Section gap={0.5} padding={0.25}>
      <Section flexDirection="row" justifyContent="between" padding={0.5}>
        <Text headingH3>{t("notifications")}</Text>
        <Button icon={SvgX} prominence="tertiary" size="sm" onClick={onClose} />
      </Section>

      <Separator noPadding className="px-2" />

      <Section>
        {isLoading ? (
          <div className="h-48">
            <Section>
              <SimpleLoader />
            </Section>
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="h-48">
            <Section>
              <Text as="p" text03>
                {t("no_notifications")}
              </Text>
            </Section>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto w-full">
            <Section alignItems="stretch" gap={0}>
              {visibleNotifications.map((notification) => (
                <LineItem
                  key={notification.id}
                  icon={getNotificationIcon(notification.notif_type)}
                  description={getNotificationDescription(notification)}
                  onClick={() => handleNotificationClick(notification)}
                  strikethrough={notification.dismissed}
                  rightChildren={
                    !notification.dismissed ? (
                      <Button
                        prominence="tertiary"
                        size="sm"
                        icon={SvgX}
                        onClick={(e) => handleDismiss(notification.id, e)}
                        tooltip={t("dismiss")}
                      />
                    ) : undefined
                  }
                >
                  {getNotificationTitle(notification)}
                </LineItem>
              ))}
            </Section>
          </div>
        )}
      </Section>
    </Section>
  );
}
