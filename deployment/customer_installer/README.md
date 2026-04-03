# AuroraChat Customer Installer

Esse fluxo é separado do deploy do seu próprio servidor. Ele existe para o seu cliente executar um único script Linux e publicar a última release estável da aplicação na infraestrutura dele.

## O que o instalador faz

- Descobre a última release estável no GitHub
- Baixa os arquivos de deploy compatíveis com aquela tag
- Garante que Docker e Docker Compose existam
- Cria ou reaproveita a configuração local
- Sobe a aplicação com Docker Compose
- Faz health check
- Guarda estado para rollback

## Uso rápido

```bash
curl -fsSL https://raw.githubusercontent.com/juankleber-woc/aurorachat/main/deployment/customer_installer/install_latest_release.sh | bash
```

Se você ainda não publicou nenhuma GitHub Release, rode com uma tag explícita:

```bash
RELEASE_TAG=v1.0.0 curl -fsSL https://raw.githubusercontent.com/juankleber-woc/aurorachat/main/deployment/customer_installer/install_latest_release.sh | bash
```

## Modos suportados

- `private`: instala para uso interno, proxy externo ou testes, expondo a aplicação localmente
- `public`: instala com domínio e HTTPS automático usando Let's Encrypt

## Variáveis úteis

```bash
NONINTERACTIVE=1 \
DEPLOY_MODE=private \
HOST_PORT=3000 \
INSTALL_ROOT=/opt/aurorachat \
curl -fsSL https://raw.githubusercontent.com/juankleber-woc/aurorachat/main/deployment/customer_installer/install_latest_release.sh | bash
```

## Operações disponíveis

Quando executado de forma interativa, o script permite:

- instalar ou atualizar para a última release estável
- fazer rollback para a release anterior
- parar a aplicação

## Arquivos criados no servidor do cliente

- Deploy: `/opt/aurorachat/deployment` ou `~/aurorachat/deployment`
- Dados auxiliares: `/opt/aurorachat/data` ou `~/aurorachat/data`
- Logs: `/opt/aurorachat/logs` ou `~/aurorachat/logs`
- Estado do rollback: `/opt/aurorachat/state/release-state.env` ou `~/aurorachat/state/release-state.env`
