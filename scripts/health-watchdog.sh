#!/bin/bash
# JARVIS Health Watchdog
# Script de surveillance qui redémarre JARVIS si il crash
# Usage: ./scripts/health-watchdog.sh [start|stop|status]

set -e

DAEMON_NAME="jarvis"
JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$HOME/.jarvis/jarvis.pid"
LOG_FILE="$HOME/.jarvis/logs/jarvis.log"
WATCHDOG_LOG="$HOME/.jarvis/logs/watchdog.log"
MAX_RESTARTS=5
RESTART_WINDOW=300

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$WATCHDOG_LOG"
}

log_info() { log "${GREEN}[WATCHDOG]${NC} $1"; }
log_warn() { log "${YELLOW}[WATCHDOG]${NC} $1"; }
log_error() { log "${RED}[WATCHDOG]${NC} $1"; }

check_bun() {
    if ! command -v bun &> /dev/null; then
        log_error "Bun n'est pas installé"
        exit 1
    fi
}

setup_dirs() {
    mkdir -p "$HOME/.jarvis/logs"
}

get_recent_restarts() {
    if [ ! -f "$HOME/.jarvis/restart_count" ]; then
        echo "1" > "$HOME/.jarvis/restart_count"
        echo "1"
        return
    fi
    
    local last_reset=$(head -1 "$HOME/.jarvis/restart_count")
    local count=$(tail -1 "$HOME/.jarvis/restart_count")
    local now=$(date +%s)
    
    if [ $((now - last_reset)) -gt $RESTART_WINDOW ]; then
        echo -e "$now\n1" > "$HOME/.jarvis/restart_count"
        echo "1"
    else
        echo $((count + 1))
    fi
}

start_watchdog() {
    if is_watchdog_running; then
        log_warn "Le watchdog est déjà en cours d'exécution"
        return
    fi
    
    setup_dirs
    check_bun
    
    log_info "Démarrage du watchdog JARVIS..."
    echo -e "$(date +%s)\n1" > "$HOME/.jarvis/restart_count"
    
    nohup bash "$0" daemon >> "$WATCHDOG_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$HOME/.jarvis/watchdog.pid"
    
    log_info "Watchdog démarré (PID: $pid)"
}

daemon_loop() {
    local check_interval=30
    
    log_info "Mode daemon activé - surveillance toutes les ${check_interval}s"
    
    while true; do
        sleep $check_interval
        
        if [ -f "$PID_FILE" ]; then
            local jarvis_pid=$(cat "$PID_FILE")
            if ! kill -0 "$jarvis_pid" 2>/dev/null; then
                log_warn "JARVIS n'est plus en cours d'exécution (PID: $jarvis_pid)"
                handle_crash
            fi
        else
            log_warn "Pas de fichier PID trouvé"
        fi
        
        check_health
    done
}

handle_crash() {
    local recent=$(get_recent_restarts)
    
    if [ "$recent" -ge "$MAX_RESTARTS" ]; then
        log_error "Trop de redémarrages récents ($recent/$MAX_RESTARTS). Arrêt du watchdog."
        stop_watchdog
        exit 1
    fi
    
    log_warn "Tentative de redémarrage ($recent/$MAX_RESTARTS)..."
    sleep 5
    
    cd "$JARVIS_DIR"
    nohup bun run src/daemon/index.ts >> "$LOG_FILE" 2>&1 &
    local new_pid=$!
    echo $new_pid > "$PID_FILE"
    
    sleep 3
    
    if kill -0 "$new_pid" 2>/dev/null; then
        log_info "JARVIS redémarré avec succès (PID: $new_pid)"
    else
        log_error "Échec du redémarrage de JARVIS"
    fi
}

check_health() {
    if curl -s --max-time 5 http://localhost:3142/api/health > /dev/null 2>&1; then
        return 0
    else
        log_warn "Health check échoué - JARVIS ne répond plus"
        return 1
    fi
}

is_watchdog_running() {
    if [ -f "$HOME/.jarvis/watchdog.pid" ]; then
        local pid=$(cat "$HOME/.jarvis/watchdog.pid")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

stop_watchdog() {
    if ! is_watchdog_running; then
        log_warn "Le watchdog n'est pas en cours d'exécution"
        return
    fi
    
    local pid=$(cat "$HOME/.jarvis/watchdog.pid")
    log_info "Arrêt du watchdog (PID: $pid)..."
    kill "$pid" 2>/dev/null || true
    rm -f "$HOME/.jarvis/watchdog.pid"
    log_info "Watchdog arrêté"
}

status_watchdog() {
    echo ""
    echo "=== JARVIS Watchdog Status ==="
    echo ""
    
    if is_watchdog_running; then
        local pid=$(cat "$HOME/.jarvis/watchdog.pid")
        local uptime=$(ps -o etime= -p $pid 2>/dev/null || echo "inconnu")
        echo -e "${GREEN}● Watchdog:${NC} En cours d'exécution"
        echo "  PID: $pid"
        echo "  Uptime: $uptime"
    else
        echo -e "${RED}● Watchdog:${NC} Arrêté"
    fi
    echo ""
    
    if [ -f "$PID_FILE" ]; then
        local jarvis_pid=$(cat "$PID_FILE")
        if kill -0 "$jarvis_pid" 2>/dev/null; then
            echo -e "${GREEN}● JARVIS:${NC} En cours d'exécution"
            echo "  PID: $jarvis_pid"
        else
            echo -e "${RED}● JARVIS:${NC} Arrêté"
        fi
    else
        echo -e "${RED}● JARVIS:${NC} Arrêté"
    fi
    
    echo ""
}

case "${1:-status}" in
    start) start_watchdog ;;
    stop) stop_watchdog ;;
    status) status_watchdog ;;
    restart)
        stop_watchdog
        sleep 2
        start_watchdog
        ;;
    daemon) daemon_loop ;;
    *) echo "Usage: $0 {start|stop|status|restart}";;
esac