#!/usr/bin/env sh
set -eu

pause_prompt() {
    # Only pause when running in an interactive terminal to prevent the window from closing immediately.
    if [ -t 0 ]; then
        printf 'Press any key to exit...'
        if command -v stty >/dev/null 2>&1; then
            _old_stty=$(stty -g 2>/dev/null || true)
            stty -icanon -echo min 1 time 0 2>/dev/null || true
            dd bs=1 count=1 >/dev/null 2>&1 || true
            if [ -n "$_old_stty" ]; then
                stty "$_old_stty" 2>/dev/null || true
            else
                stty icanon echo 2>/dev/null || true
            fi
        else
            read -r _ 2>/dev/null || true
        fi
        printf '\n'
    fi
}

TEMP_DIR=''

cleanup() {
    exit_code=$?
    trap - EXIT INT TERM
    if [ -n "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
    pause_prompt
    exit "$exit_code"
}

trap cleanup EXIT INT TERM

ACTION="${1:-}"

case "$ACTION" in
    install)
        MKCERT_ACTION='-install'
        ACTION_DESCRIPTION='install root CA certificate to the system trust store'
        COMPLETE_MESSAGE='Installation complete.'
        ;;
    uninstall)
        MKCERT_ACTION='-uninstall'
        ACTION_DESCRIPTION='uninstall root CA certificate from the system trust store'
        COMPLETE_MESSAGE='Uninstallation complete.'
        ;;
    *)
        echo '[mkcert-containerized] Usage: manage-rootCA.sh <install|uninstall>' >&2
        exit 1
        ;;
esac

THIS_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_CA_PATH="$THIS_DIR/rootCA.pem"

# Somewhat redundant, as `mkcert` also checks for the presence of `rootCA.pem` in the `$CAROOT` directory.
# That being said, it saves an unnecessary download of the `mkcert` binary if both the bundled binary and the certificate are missing.
if [ ! -f "$ROOT_CA_PATH" ]; then
    echo "[mkcert-containerized] Expected root CA certificate at $ROOT_CA_PATH" >&2
    exit 1
fi

OS_NAME="$(uname -s)"
ARCH_NAME="$(uname -m)"

case "$OS_NAME/$ARCH_NAME" in
    Darwin/x86_64|Darwin/amd64)
        BINARY_ARCHITECTURE='DARWIN_AMD64'
        BINARY_FILENAME='mkcert-darwin-amd64'
        ;;
    Darwin/arm64|Darwin/aarch64)
        BINARY_ARCHITECTURE='DARWIN_ARM64'
        BINARY_FILENAME='mkcert-darwin-arm64'
        ;;
    Linux/x86_64|Linux/amd64)
        BINARY_ARCHITECTURE='LINUX_AMD64'
        BINARY_FILENAME='mkcert-linux-amd64'
        ;;
    Linux/arm64|Linux/aarch64)
        BINARY_ARCHITECTURE='LINUX_ARM64'
        BINARY_FILENAME='mkcert-linux-arm64'
        ;;
    Linux/armv7l|Linux/armv6l|Linux/arm)
        BINARY_ARCHITECTURE='LINUX_ARM'
        BINARY_FILENAME='mkcert-linux-arm'
        ;;
    *)
        echo "[mkcert-containerized] Unsupported host OS/architecture: $OS_NAME/$ARCH_NAME" >&2
        exit 1
        ;;
esac

load_env_file() {
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ''|\#*) continue ;;
        esac

        key=${line%%=*}
        value=${line#*=}
        export "$key=$value"
    done < "$1"
}

read_env_value() {
    var_name=$1
    eval "printf '%s' \"\${$var_name:-}\""
}

get_fallback_download_url() {
    case "$1" in
        DARWIN_AMD64) printf '%s' 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-darwin-amd64' ;;
        DARWIN_ARM64) printf '%s' 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-darwin-arm64' ;;
        LINUX_AMD64)  printf '%s' 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64' ;;
        LINUX_ARM64)  printf '%s' 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-arm64' ;;
        LINUX_ARM)    printf '%s' 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-arm' ;;
        *)            printf '' ;;
    esac
}

BINARY_PATH="$THIS_DIR/$BINARY_FILENAME"

if [ -f "$BINARY_PATH" ]; then
    echo "[mkcert-containerized] Using bundled mkcert binary at $BINARY_PATH..."
else
    BINARY_DOWNLOAD_URL=''
    ENV_FILE="$THIS_DIR/mkcert-containerized.env"
    if [ -f "$ENV_FILE" ]; then
        load_env_file "$ENV_FILE"
        BINARY_ENV_KEY="MKCERT_${BINARY_ARCHITECTURE}_URL"
        BINARY_DOWNLOAD_URL=$(read_env_value "$BINARY_ENV_KEY")
    fi

    # Fall back to known stable `mkcert` release download URLs if neither bundled binary nor environment metadata exists.
    if [ -z "$BINARY_DOWNLOAD_URL" ]; then
        BINARY_DOWNLOAD_URL=$(get_fallback_download_url "$BINARY_ARCHITECTURE")
    fi

    if [ -z "$BINARY_DOWNLOAD_URL" ]; then
        echo "[mkcert-containerized] No mkcert download URL is available for $BINARY_ARCHITECTURE" >&2
        exit 1
    fi

    TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mkcert-containerized.XXXXXX")"
    CACHE_DIR="$TEMP_DIR/.bin"
    mkdir -p "$CACHE_DIR"
    BINARY_PATH="$CACHE_DIR/mkcert"

    echo "[mkcert-containerized] Downloading mkcert binary from $BINARY_DOWNLOAD_URL to $BINARY_PATH..."
    if command -v curl >/dev/null 2>&1; then
        curl -fL "$BINARY_DOWNLOAD_URL" -o "$BINARY_PATH"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$BINARY_PATH" "$BINARY_DOWNLOAD_URL"
    else
        echo '[mkcert-containerized] Neither curl nor wget is available on the host machine.' >&2
        exit 1
    fi
    echo '[mkcert-containerized] Download complete.'
fi

chmod +x "$BINARY_PATH"
echo "[mkcert-containerized] Setting CAROOT environment variable to $THIS_DIR..."
echo "[mkcert-containerized] Running mkcert binary to $ACTION_DESCRIPTION..."
CAROOT="$THIS_DIR" "$BINARY_PATH" "$MKCERT_ACTION"
echo "[mkcert-containerized] $COMPLETE_MESSAGE"
