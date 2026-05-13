# NauticShield Superyacht Tech Stack Baseline (MVA - Minimum Viable Assumption)

Build to this stack first. Validate and expand once we have live boats.

---

## Internet & Failover

**Most Common Setup**:
- Primary: Starlink VSAT (or similar satellite, 15-30 Mbps)
- Backup: LTE modem or second VSAT (3-10 Mbps, rarely used)
- Modem → Consumer router (Ubiquiti Dream Machine or TP-Link)
- Manual failover or basic routing

**What We Build For**:
- Show which link is active (via agent-side route checking)
- Alert when primary drops
- Show latency and quality per link
- Track failover events in the log

**Not Building Yet**:
- Automatic failover switching
- Advanced BGP or policy routing
- Direct Starlink API integration

---

## Core Network Stack

**Most Common Setup**:
- Main router: Ubiquiti Dream Machine (UDM) or similar (edgerouter)
- APs: 2-3 Ubiquiti UniFi APs (living areas, bridge, crew quarters)
- Wired devices: ~30-50 (mix of servers, cameras, AV gear, navigation systems, crew laptops/phones)
- Guest network: Separate SSID, basic isolation

**Assumptions**:
- Router supports SSH (we can access via command line)
- DHCP is serving a /24 or larger subnet
- No advanced VLAN configuration (or basic ones we can discover)
- Minimal documentation of what is what

**What We Build For**:
- ARP-based device discovery (our current agent/src/scanner.ts)
- MAC → OUI lookup for device type (Ubiquiti, Raspberry Pi, Apple, etc.)
- Unknown device alerts
- Block/allow device via router access control lists (iptables or Ubiquiti API)
- Device last-seen tracking

**Not Building Yet**:
- Full VLAN mapping and traffic analysis
- Advanced intrusion detection
- Per-device firewall rules (beyond block/allow)

---

## AV / Smart Control Systems

**Most Common Setup**:
- Control system: Crestron, Savant, or Control4 (if it exists, usually older)
- Devices: Yamaha/Denon amplifiers, Samsung/LG TVs, Apple TV devices
- Access: Usually wired to main network or isolated mini-network
- Status: Often undocumented and forgotten after installation

**Assumptions**:
- If there is a control system, it uses DHCP
- Devices respond to mDNS or are discoverable via ARP
- Crestron/Savant usually run on Windows or proprietary OS
- No real-time telemetry we can access cheaply

**What We Build For**:
- Detect and list AV devices (by type signature or OUI)
- Show if they are online/offline
- Flag if control system appears to be off or unreachable

**Not Building Yet**:
- Control system state querying (would require vendor-specific APIs)
- AV event streaming or automation
- Cinema room-specific scheduling

---

## Navigation & OT Systems

**Most Common Setup**:
- ECDIS: Chart plotter (Furuno, Navico, or Simrad) — usually wired, isolated
- Radar: Integrated with ECDIS or standalone (Furuno, Navico)
- AIS receiver: Integrated with ECDIS or standalone
- Engine monitoring: Dedicated standalone system (Volvo, MAN, or proprietary)
- Autopilot: Usually hardwired to helm, not networked

**Assumptions**:
- OT systems are on a separate VLAN or isolated network segment
- If they are visible on the main network at all, they have fixed IPs
- Navigation systems rarely connect to the internet (some newer ones do for chart updates)
- Engine monitoring is usually 4-20mA analog or CAN bus, not IP-based

**What We Build For**:
- Detect OT devices (by static IP or MAC OUI patterns)
- Alert if OT system appears on guest/crew network (segmentation violation)
- Track if OT systems are powered on/responding
- Flag if newer systems have internet connectivity

**Not Building Yet**:
- NMEA stream parsing
- Engine telemetry analytics
- Route/waypoint tracking
- Advanced OT anomaly detection

---

## CCTV & Security

**Most Common Setup**:
- Camera count: 6-15 (bridge, main saloon, guest areas, stern deck, engine room)
- Brands: Axis, Hikvision, Avigilon (rarely integrated)
- NVR: Standalone Windows PC or Hikvision NVR
- Storage: Local NAS or boat-based server
- Access: Usually wired to main network, often default credentials

**Assumptions**:
- CCTV cameras and NVR are on the main network (sometimes isolated VLAN)
- Devices respond to DHCP or have static IPs
- Many cameras are running outdated firmware
- Default admin credentials are often still in use

**What We Build For**:
- Detect Axis, Hikvision, Avigilon cameras by OUI/MAC prefix
- Detect NVR systems (by port scanning for RTSP or web UI)
- Cross-check detected camera models against known CVE database
- Flag if cameras are likely using default credentials
- Alert if a camera disappears or goes offline unexpectedly

**Not Building Yet**:
- RTSP stream integrity checking
- Video analytics or object detection
- Access control system integration
- Advanced camera firmware audit

---

## Crew & Guest IT

**Most Common Setup**:
- Devices: 20-40 crew + guest smartphones/laptops/tablets
- Usage: Streaming (Netflix, Spotify), email, messaging, work calls
- Wi-Fi: Single guest SSID or separate crew SSID (weak isolation)
- Guests: High turnover, often bring personal devices

**Assumptions**:
- Guest network is a separate SSID but may not be properly isolated
- Most crew have personal devices (not managed)
- Bandwidth is highly constrained (limited satellite uplink)
- Streaming and updates cause network congestion

**What We Build For**:
- Show active guest devices (count, types)
- Block/allow guest device from network
- Show top bandwidth consumers on guest network
- Alert if guest device stops responding (detection of disconnects/troubleshooting)
- Track bandwidth usage by device (basic accounting)

**Not Building Yet**:
- Advanced QoS or traffic shaping
- Streaming service detection or blocking
- Mobile device management (MDM)
- Captive portal with splash page

---

## Monitoring & Remote Support

**Most Common Setup**:
- Current: Spot checks, WhatsApp complaints, manual troubleshooting
- Tools: TeamViewer or AnyDesk if something breaks
- Support model: Vendor support (slow), in-house crew (overextended)
- Logging: Usually paper logbook or email trail (unsearchable)

**Assumptions**:
- No centralized monitoring or alerting exists today
- Crew want to know about problems before owner complains
- Remote support is reactive, not proactive
- Audit trail is important for liability

**What We Build For**:
- Alert on critical events (internet down, unknown device, OT system unreachable)
- Daily email summary (network health, device status, unresolved issues)
- Incident log (searchable, timestamped, actor-tracked)
- Email notification when critical finding appears

**Not Building Yet**:
- Integration with TeamViewer or AnyDesk
- Automated ticket routing
- Multi-user collaboration dashboards
- Mobile app push notifications

---

## Cybersecurity Stack

**Most Common Setup**:
- Firewall: Integrated in Ubiquiti router or consumer firewall
- IDS/IPS: None (or basic)
- Antivirus: None (or outdated on individual devices)
- Access control: Default or unchanged admin credentials
- Patches: Ad-hoc or out of date

**Assumptions**:
- No security tools are running today (except basic firewall)
- Router has basic rules but they are rarely audited
- Most devices are running outdated firmware
- Owner/captain has no visibility into cyber posture
- Compliance (BIMCO, IMO, IACS) is vague or unknown

**What We Build For**:
- Firewall rule audit (read router, identify overly permissive rules)
- CVE matching (detect known vulnerable devices: cameras, routers, etc.)
- Cyber finding workflow (create, track remediation, add notes)
- MFA enforcement check (alert if admin MFA is disabled)
- Security posture score (0-100 based on critical findings)

**Not Building Yet**:
- Full SIEM or log aggregation
- Behavior analytics or ML detection
- Advanced threat intelligence feeds
- Compliance automation (can be added after)
- Vulnerability scanning (requires agent to live on network for weeks)

---

## Reporting

**Most Common Setup**:
- Current reports: None or manual email
- Owner expectations: Know network is healthy without opening app
- Captain needs: Quick visibility into alerts and actions taken

**Assumptions**:
- Email is the only reliable channel for notifications
- Owner checks email daily but may not open app
- Reports need to be short and actionable (not 50-page PDFs)

**What We Build For**:
- Daily summary email (5-7 bullet points):
  - Active threats
  - New devices
  - Blocked/offline devices
  - Network health score
  - Internet quality
  - Unresolved cyber findings
- Weekly cyber findings report (detailed):
  - All findings (grouped by severity)
  - Remediation status
  - Evidence/notes
  - CVSS scores

**Not Building Yet**:
- Compliance evidence export (IMO/IACS/NIS2)
- Custom report builder
- Board-level reporting (can add later)

---

## Identity & Access

**Most Common Setup**:
- Users: Owner/captain + IT crew (1-2 people)
- Auth: Admin email + password (or blank)
- MFA: Rarely used
- Roles: Usually just admin or nothing

**Assumptions**:
- Small number of users (< 5)
- Roles are simple (admin or view-only)
- MFA is new and needs to be easy to set up

**What We Build For**:
- Email + password + optional TOTP setup
- Two roles: Admin (block devices, set rules, see all data) and Monitor (view-only)
- Admin action audit log (who did what, when)

**Not Building Yet**:
- RBAC (multiple roles)
- SSO/SAML integration
- Advanced identity risk detection
- Helpdesk workflows

---

## Hardware Assumptions

**Where NauticShield Agent Lives**:
- Option 1: Mini-PC in router cabinet (Raspberry Pi, Intel NUC, or boat's existing PC)
- Option 2: Docker container on Ubiquiti Dream Machine (if supported)
- Option 3: Dedicated mini-appliance we provide (future)

**Agent Connectivity**:
- Agent connects to local router via Ethernet (reliable)
- Agent posts findings to NauticShield cloud via internet link (handles intermittent satellite)
- Agent caches locally if cloud is down (offline-first)

**Pilot Hardware Requirements**:
- 1 Gbps Ethernet port available (or 100 Mbps acceptable)
- 2-4 CPU cores, 4-8 GB RAM (Raspberry Pi 4 qualifies)
- 50 GB disk space (for agent logs, findings, reports)
- Power: 24-hour supply (most routers have UPS already)

---

## Summary: What We're Building

**Week 1-2**: Device discovery and inventory
- ARP scan, ping sweep, OUI lookup
- Device classification (router, camera, laptop, unknown)
- Unknown device alert

**Week 2-3**: Device control and blocking
- Block/allow device at router
- Persist blocking across reboots
- Real-time status in app

**Week 3-4**: OT and AV visibility
- Detect navigation/OT systems
- Detect AV systems and control boxes
- Segmentation check (OT should not be on guest network)

**Week 4-5**: CCTV and security scanning
- Camera device detection
- CVE matching from Maritime CVE DB
- Default credential flagging

**Week 5-6**: Cyber findings and remediation
- Create/update/track cyber findings
- Attach evidence and notes
- Remediation status workflow

**Week 6-7**: Reporting and alerting
- Daily email summary
- Weekly cyber findings report
- Critical alert notifications

**Week 7-8**: Pilot hardening and testing
- Stability testing (24+ hour runs)
- Edge case handling (network changes, device reboots)
- Documentation for boat deployment

---

## Expansion Points (Post-Pilot)

Once we have live boats and can validate the common stack assumptions, we can add:
- Boat-specific OT protocol support (NMEA, CAN bus)
- Advanced AV system integrations (Crestron API, Savant APIs)
- Specialized VLAN and traffic analysis
- Behavior analytics and ML anomaly detection
- Third-party remote access governance (TeamViewer/AnyDesk audit)
- Compliance automation (IMO/IACS/NIS2 evidence generation)
