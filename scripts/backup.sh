#!/bin/bash
# JARVIS Backup Script
# Backup/Restore pour la base de données et config

set -e

JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$HOME/.jarvis/backups"
DB_PATH="$HOME/.jarvis/jarvis.db"
MAX_BACKUPS=10

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[BACKUP]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[BACKUP]${NC} $1"; }
log_error() { echo -e "${RED}[BACKUP]${NC} $1"; }

setup_backup_dir() {
    mkdir -p "$BACKUP_DIR"
}

get_backup_name() {
    echo "jarvis-backup-$(date '+%Y%m%d-%H%M%S').tar.gz"
}

create_backup() {
    setup_backup_dir
    local backup_name=$(get_backup_name)
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log_info "Création du backup: $backup_name"
    
    if [ -f "$DB_PATH" ]; then
        log_info "  + Base de données: $DB_PATH"
    fi
    
    tar -czf "$backup_path" -C "$HOME" .jarvis 2>/dev/null || true
    
    if [ -f "$backup_path" ]; then
        local size=$(du -h "$backup_path" | cut -f1)
        log_info "Backup créé: $backup_path ($size)"
        clean_old_backups
    else
        log_error "Échec de la création du backup"
        return 1
    fi
}

list_backups() {
    setup_backup_dir
    
    echo ""
    echo "=== JARVIS Backups ==="
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "Aucun backup trouvé"
        return 0
    fi
    
    for backup in "$BACKUP_DIR"/*.tar.gz; do
        if [ -f "$backup" ]; then
            local size=$(du -h "$backup" | cut -f1)
            local date=$(date -r "$backup" '+%Y-%m-%d %H:%M')
            echo "  $(basename "$backup") - $size - $date"
        fi
    done
    
    echo ""
}

clean_old_backups() {
    setup_backup_dir
    
    local backup_count=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
    if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
        local to_remove=$((backup_count - MAX_BACKUPS))
        log_info "Nettoyage: $to_remove vieux backup(s)"
        ls -1t "$BACKUP_DIR"/*.tar.gz | tail -n "$to_remove" | xargs rm -f 2>/dev/null || true
    fi
}

restore_backup() {
    if [ -z "$1" ]; then
        log_error "Usage: $0 restore <fichier_backup>"
        return 1
    fi
    
    local backup_file="$BACKUP_DIR/$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup non trouvé: $backup_file"
        return 1
    fi
    
    log_warn "Restauration du backup: $1"
    
    if [ -f "$HOME/.jarvis/jarvis.pid" ]; then
        local pid=$(cat "$HOME/.jarvis/jarvis.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            sleep 2
        fi
    fi
    
    tar -xzf "$backup_file" -C "$HOME" 2>/dev/null || true
    
    log_info "Restauration terminée"
}

case "${1:-}" in
    now) create_backup ;;
    list) list_backups ;;
    restore) restore_backup "$2" ;;
    clean) clean_old_backups ;;
    *) 
        echo "JARVIS Backup Script"
        echo "Usage: $0 {now|list|restore|clean}"
        echo ""
        list_backups
        ;;
esac