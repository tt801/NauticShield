# NauticShield MVP Feature Decision Matrix

Use this matrix to decide what goes into the 8-week pilot build vs. what is deferred.

**Decision rule**: If it does not directly address a pain point identified in the chief engineer interview, it is deferred.

---

## 1. Connectivity Layer

### Must Build
- **WAN failover visibility**
  - Show which link is active (Starlink, VSAT, LTE)
  - Alert when primary link drops
  - Show estimated failover time
  - **Why**: Every yacht has failover pain. This solves it.

- **Internet quality tracking**
  - Latency, jitter, packet loss
  - Download/upload speed
  - Provider attribution
  - **Why**: Eliminates "blame the Wi-Fi" arguments.

### Defer (Post-Pilot)
- Active link switching automation
- BGP or advanced routing logic
- Vendor API integrations (KVH, Starlink direct APIs)
- **Why**: Nice to have, but not critical for pilot value.

---

## 2. Core Network Stack

### Must Build
- **Device discovery and inventory**
  - ARP scan, ping sweep, MAC OUI lookup
  - Device type classification (router, camera, laptop, unknown)
  - Last-seen timestamp
  - Status (online/offline)
  - **Why**: Fundamental visibility problem. All pilots need this.

- **Unknown device alerts**
  - Trigger when a new MAC address appears
  - Show classification attempt and confidence
  - Allow operator to label or block
  - **Why**: Addresses rogue device risk.

- **Device isolation / blocking**
  - Block a device at the access point or router level
  - Persist the block across reboots
  - Show block status in app
  - **Why**: Operationalizes guest network control.

### Defer (Post-Pilot)
- Full VLAN mapping and traffic analysis
- Advanced network topology visualization
- Intrusion detection / IDS
- Deep packet inspection
- **Why**: Complex, requires more data collection first.

---

## 3. AV / Smart Control Systems

### Must Build
- **AV device discovery**
  - Detect Crestron, Savant, Lutron, Control4 devices if they are on the network
  - Label them clearly
  - **Why**: Helps troubleshoot when owner complains about entertainment system.

### Defer (Post-Pilot)
- AV system health / dependency mapping
- Control4 integration for event streaming
- Cinema / cabin automation monitoring
- **Why**: Requires vendor integrations and deep knowledge of each system.

---

## 4. Navigation & OT Systems

### Must Build
- **OT device discovery**
  - Detect ECDIS, radar, AIS, engine monitoring if they are on the network
  - Isolate them clearly from guest/crew networks
  - Alert if they appear on unexpected networks
  - **Why**: Safety and segmentation validation.

- **OT network segmentation check**
  - Verify nav systems are not on guest VLAN
  - Verify crew cannot access OT systems
  - Simple boolean pass/fail
  - **Why**: Compliance and risk reduction.

### Defer (Post-Pilot)
- NMEA protocol parsing
- Engine telemetry analytics
- Fuel system monitoring
- Advanced OT anomaly detection
- **Why**: Requires deep maritime OT knowledge and vendor partnerships.

---

## 5. CCTV & Security

### Must Build
- **CCTV device discovery**
  - Detect Axis, Hikvision, Avigilon cameras and NVRs
  - Flag known vulnerable models or firmware versions
  - **Why**: Common attack vector; easy to add to CVE database.

- **Default credential check**
  - Detect CCTV / camera devices
  - Flag if default admin credentials might still be in use
  - **Why**: Low effort, high value.

### Defer (Post-Pilot)
- RTSP stream integrity checking
- Video analytics
- Access control system integration
- **Why**: Requires vendor protocols and field testing.

---

## 6. Crew & Guest IT

### Must Build
- **Guest device tracking**
  - Show known vs. unknown guest devices
  - Allow operator to block devices from guest Wi-Fi
  - **Why**: Operational pain point (streaming, roaming, dead zones).

- **Bandwidth visibility (basic)**
  - Show top talkers on guest network
  - Alert if one device is consuming most bandwidth
  - **Why**: Explains guest complaints about slow Wi-Fi.

### Defer (Post-Pilot)
- Advanced QoS and traffic shaping
- Streaming service detection
- Captive portal integration
- **Why**: Requires more detailed network telemetry.

---

## 7. Monitoring & Remote Support

### Must Build
- **Incident logging**
  - Record every alert, action, and resolution
  - Timestamp, actor, result
  - Searchable history
  - **Why**: Audit trail and accountability.

- **Alert notification**
  - Email or SMS on critical events
  - Configurable thresholds
  - **Why**: Keeps operator informed without opening app constantly.

### Defer (Post-Pilot)
- Integration with TeamViewer or AnyDesk
- Automated ticket creation
- Multi-user collaboration workflows
- **Why**: Requires vendor partnerships and complex state management.

---

## 8. Cybersecurity Stack

### Must Build
- **Firewall rule audit**
  - Read current firewall rules (via SSH or API)
  - Flag overly permissive rules
  - Flag outdated or disabled rules
  - **Why**: Quick win for security posture.

- **Vulnerability database**
  - Known CVEs for detected devices (cameras, routers, etc.)
  - CVSS score and remediation advice
  - Link to BIMCO maritime standards where applicable
  - **Why**: Operationalizes threat assessment.

- **Critical finding workflow**
  - Create cyber finding for high-severity issues
  - Track remediation status
  - Add notes and evidence
  - **Why**: Bridges cyber assessment and operational response.

- **MFA enforcement check**
  - Verify MFA is enabled for admin accounts
  - Alert if disabled
  - **Why**: Simple compliance win.

### Defer (Post-Pilot)
- Full SIEM or log aggregation
- Behavior analytics and ML detection
- Advanced threat intelligence feeds
- Compliance automation for IMO/IACS/NIS2
- **Why**: Requires infrastructure build-out and field validation.

---

## 9. Reporting

### Must Build
- **Daily summary report**
  - Active threats
  - New devices
  - Blocked devices
  - Unresolved findings
  - Internet quality (latency, provider)
  - **Why**: Owner wants daily pulse without opening app.

- **Weekly cyber findings report**
  - Open findings
  - Remediation status
  - Critical issues highlighted
  - **Why**: Board/owner requirement.

### Defer (Post-Pilot)
- Compliance evidence export (IMO/IACS)
- Custom report builder
- Scheduled report distribution
- **Why**: Can be added quickly after pilot validates report value.

---

## 10. Identity & Access

### Must Build
- **MFA setup for pilot**
  - TOTP authenticator app
  - Simple verify/disable workflow
  - **Why**: Already in codebase; just validate it works.

- **Admin action audit**
  - Log who blocked which device
  - Log who approved remediation actions
  - **Why**: Accountability and compliance.

### Defer (Post-Pilot)
- Role-based access control (RBAC)
- Helpdesk approval workflows
- Advanced identity risk detection
- **Why**: Can be added after pilot defines user roles.

---

## 11. Pilot MVP Go / No-Go Checklist

Before deploying to the first boat, confirm:

- [ ] Device discovery and labeling works reliably
- [ ] Device blocking / isolation works end to end
- [ ] Alerts are clear and actionable (not noisy)
- [ ] Cyber findings can be created, updated, and tracked
- [ ] Daily report can be generated and emailed
- [ ] MFA setup works
- [ ] Onboarding flow is understandable for a non-technical owner
- [ ] App is stable for 24+ hours of continuous use

---

## 12. Features by Boat (Customize per Interview)

After interviewing the chief engineers, fill in which features matter most to each boat:

### Boat 1
- **Top priority**: [e.g., "Internet failover visibility + guest device control"]
- **Secondary**: [e.g., "CCTV device discovery + default credential alerts"]
- **Quick win**: [e.g., "Device inventory + unknown device alerts"]

### Boat 2
- **Top priority**: [e.g., "OT segmentation check + CCTV security posture"]
- **Secondary**: [e.g., "Internet quality tracking + firewall audit"]
- **Quick win**: [e.g., "Cyber findings workflow + incident logging"]
