#!/usr/bin/env bash

set -u
set -o pipefail

SUBNET="${DISCOVERY_SUBNET:-}"

echo "[$(date -Iseconds)] START network discovery scan (Nmap)" >&2

if [ -z "${SUBNET}" ]; then
  echo "ERROR: DISCOVERY_SUBNET is not configured (set it in .env, e.g. 192.168.1.0/24)" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: docker daemon is not available" >&2
  exit 1
fi

echo "Scanning subnet: ${SUBNET}" >&2

# Runs Nmap in its own throwaway container. Deliberately does NOT use
# `--network host`: (1) Docker's host-networking driver is documented as
# Linux-only and is not supported on Docker Desktop for Windows/Mac (the
# actual deployment target here) — it either errors or silently behaves
# like the default bridge network there, which was the real bug behind an
# earlier "scan runs but finds nothing" report; (2) it isn't even needed —
# Nmap's probes here are outbound connections (SYN/ICMP/ARP-fallback), and
# Docker's default bridge network already NATs outbound traffic through the
# host, the same way any container can reach the internet. That's enough
# for reaching other devices on the same LAN the Docker host is on.
#
# nmap's own stderr is intentionally NOT discarded (no `2>/dev/null`) so a
# real failure (bad privileges, DNS/route issue, etc.) shows up in the
# backend's logs and in the scan status instead of silently looking like
# "0 hosts found".
#
# --cap-add=NET_RAW/NET_ADMIN: explicit, not just relying on Docker's
# default capability set. Nmap needs raw-socket access to build real
# ICMP/ARP host-discovery probes; without it, Nmap can't tell "up" from
# "down" at all and its documented fallback is to treat *every* target as
# online (same effect as -Pn) so it can still attempt the port scan —
# which is exactly the bug this fixes: a /24 reporting all 256 addresses
# as "up" with no hostname/ports data is the signature of that fallback,
# not a real network.
# Hardened throwaway container (defense-in-depth for the brokered Docker
# access): drop ALL capabilities then re-add only the two Nmap actually needs,
# forbid privilege escalation, and run with a read-only root filesystem (Nmap
# writes its XML to stdout via `-oX -`, so it needs no writable rootfs; a small
# in-memory /tmp is provided just in case).
docker run --rm \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --cap-add NET_RAW --cap-add NET_ADMIN \
  --read-only --tmpfs /tmp \
  instrumentisto/nmap:latest \
  -T4 -F -oX - "${SUBNET}"

echo "[$(date -Iseconds)] DONE network discovery scan" >&2
