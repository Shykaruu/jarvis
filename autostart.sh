#!/bin/bash
# JARVIS Auto-start Script
# Démarre JARVIS au démarrage de la machine
# Usage: ./autostart.sh [install|uninstall|start|stop|status]

set -e

DAEMON_NAME="jarvis"
DAEMON_USER=$(whoami)
JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="/etc/systemd/system/${DAEMON_NAME}.service"
PID_FILE="$HOME/.jarvis/jarvis.pid"
LOG_FILE="$HOME/.jarvis/logs/jarvis.log"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Vérifie si bun est disponible
check_bun() {
    if ! command -v bun &> /dev/null; then
        log_error "Bun n'est pas installé. Installez-le avec: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    log_info "Bun version: $(bun --version)"
}

# Crée les dossiers nécessaires
setup_dirs() {
    mkdir -p "$HOME/.jarvis/logs"
    mkdir -p "$JARVIS_DIR/node_modules" 2>/dev/null || true
}

# Démarre JARVIS en arrière-plan
start_daemon() {
    check_bun
    setup_dirs
    
    if is_running; then
        log_warn "JARVIS est déjà en cours d'exécution (PID: $(cat $PID_FILE))"
        return
    fi
    
    log_info "Démarrage de JARVIS..."
    
    cd "$JARVIS_DIR"
    nohup bun run src/daemon/index.ts > "$LOG_FILE" 2>&1 &
    local pid=$!
    
    echo $pid > "$PID_FILE"
    
    sleep 2
    
    if is_running; then
        log_info "JARVIS démarré avec succès (PID: $pid)"
        log_info "Dashboard accessible sur http://localhost:3142"
        log_info "Logs: tail -f $LOG_FILE"
    else
        log_error "Échec du démarrage. Voir les logs: cat $LOG_FILE"
        rm -f "$PID_FILE"
    fi
}

# Arrête JARVIS
stop_daemon() {
    if ! is_running; then
        log_warn "JARVIS n'est pas en cours d'exécution"
        return
    fi
    
    local pid=$(cat $PID_FILE)
    log_info "Arrêt de JARVIS (PID: $pid)..."
    
    kill $pid 2>/dev/null || true
    
    local count=0
    while is_running && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done
    
    if is_running; then
        log_warn "Forçage de l'arrêt..."
        kill -9 $pid 2>/dev/null || true
    fi
    
    rm -f "$PID_FILE"
    log_info "JARVIS arrêté"
}

# Vérifie si JARVIS tourne
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat $PID_FILE)
        if kill -0 $pid 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Statut
status_daemon() {
    if is_running; then
        local pid=$(cat $PID_FILE)
        local uptime=$(ps -o etime= -p $pid 2>/dev/null || echo "inconnu")
        log_info "JARVIS est en cours d'exécution"
        echo "  PID: $pid"
        echo "  Uptime: $uptime"
        echo "  Dashboard: http://localhost:3142"
        echo "  Logs: $LOG_FILE"
    else
        log_info "JARVIS n'est pas en cours d'exécution"
    fi
}

# Installation systemd (root requis)
install_systemd() {
    if [ "$EUID" -ne 0 ]; then
        log_error "L'installation systemd nécessite les droits root"
        log_info "Utiliser: sudo $0 install"
        return
    fi
    
    check_bun
    setup_dirs
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=JARVIS - Just A Rather Very Intelligent System
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$JARVIS_DIR
ExecStart=/bin/bash -c 'source ~/.bashrc && bun run src/daemon/index.ts'
Restart=always
RestartSec=10
StandardOutput=append:$HOME/.jarvis/logs/jarvis.log
StandardError=append:$HOME/.jarvis/logs/jarvis.log

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "$DAEMON_NAME"
    log_info "Service systemd installé"
    log_info "Commandes: systemctl start|stop|status jarvis"
}

# Désinstallation systemd
uninstall_systemd() {
    if [ "$EUID" -ne 0 ]; then
        log_error "La désinstallation nécessite les droits root"
        return
    fi
    
    systemctl stop "$DAEMON_NAME" 2>/dev/null || true
    systemctl disable "$DAEMON_NAME" 2>/dev/null || true
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    log_info "Service systemd désinstallé"
}

# Affiche les logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        log_error "Logs non trouvés: $LOG_FILE"
    fi
}

# Menu principal
case "${1:-start}" in
    install)
        install_systemd
        ;;
    uninstall)
        uninstall_systemd
        ;;
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        status_daemon
        ;;
    restart)
        stop_daemon
        start_daemon
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 {install|uninstall|start|stop|status|restart|logs}"
        exit 1
        ;;
esac