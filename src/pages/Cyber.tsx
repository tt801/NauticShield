import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Radar,
  Fingerprint,
  Lock,
  Unlock,
  Globe,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  CalendarCheck,
  CalendarX,
  Laptop,
  Smartphone,
  HardDrive,
  BadgeCheck,
  BadgeAlert,
  Eye,
  EyeOff,
  Flame,
  WifiOff,
  Cpu,
  X,
  Info,
  Ban,
  RefreshCw,
} from 'lucide-react';
import { useVesselData } from '@/context/VesselDataProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Device } from '@/data/mock';
import { agentApi } from '@/api/client';
import type { CyberFinding } from '@/api/client';

// ── Design tokens ────────────────────────────────────────────────

const GOLD   = '#d4a847';
const GOLD_BG  = 'rgba(212,168,71,0.08)';
const GOLD_BORDER = 'rgba(212,168,71,0.25)';

// ── Types ─────────────────────────────────────────────────────────

type ThreatLevel    = 'critical' | 'high' | 'medium' | 'low' | 'clear';
type FirewallRule   = { id: string; name: string; direction: 'inbound' | 'outbound'; action: 'allow' | 'block'; port: string; protocol: string; enabled: boolean };
type ThreatEntry    = { id: string; deviceId?: string; deviceName: string; ip: string; type: string; detail: string; level: ThreatLevel; time: string; mitigated: boolean };
type ScanResult     = { id: string; deviceId: string; deviceName: string; ip: string; openPorts: number[]; riskPorts: number[]; manufacturer: string; flagged: boolean };
type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved';
type Incident       = { id: string; title: string; description: string; severity: 'critical' | 'high' | 'medium'; status: IncidentStatus; opened: string; updated: string; assignee: string; slaHours: number };
type PenTestFinding = { id: string; category: string; title: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string; remediated: boolean };
type PenTest        = { id: string; label: string; firm: string; date: string; result: 'pass' | 'fail' | 'scheduled'; score: number; findings: PenTestFinding[]; nextDue: string; reportRef: string };
type ProtectionStatus = 'protected' | 'partial' | 'unprotected';
type DeviceProtection = { deviceId: string; name: string; ip: string; type: string; edr: boolean; epp: boolean; encrypted: boolean; status: ProtectionStatus };

// ── Static premium data ───────────────────────────────────────────

const defaultFirewallRules: FirewallRule[] = [
  { id: 'fw1', name: 'Block Telnet',       direction: 'inbound',  action: 'block', port: '23',   protocol: 'TCP', enabled: true  },
  { id: 'fw2', name: 'Block RDP',          direction: 'inbound',  action: 'block', port: '3389', protocol: 'TCP', enabled: true  },
  { id: 'fw3', name: 'Allow HTTPS',        direction: 'outbound', action: 'allow', port: '443',  protocol: 'TCP', enabled: true  },
  { id: 'fw4', name: 'Allow DNS',          direction: 'outbound', action: 'allow', port: '53',   protocol: 'UDP', enabled: true  },
  { id: 'fw5', name: 'Block SMB',          direction: 'inbound',  action: 'block', port: '445',  protocol: 'TCP', enabled: true  },
  { id: 'fw6', name: 'Block Telnet (out)', direction: 'outbound', action: 'block', port: '23',   protocol: 'TCP', enabled: false },
];

const mockThreats: ThreatEntry[] = [
  { id: 't1', deviceName: 'Unknown Device',    ip: '192.168.0.138', type: 'Rogue Device',          detail: 'Unrecognised MAC — no hostname, probe requests to 5 SSIDs', level: 'critical', time: new Date(Date.now() - 1000*60*4).toISOString(),  mitigated: false },
  { id: 't2', deviceName: 'Samsung Smart TV',  ip: '192.168.0.42',  type: 'Telemetry Beacon',      detail: 'Outbound connections to Samsung analytics on port 4443',     level: 'medium',   time: new Date(Date.now() - 1000*60*22).toISOString(), mitigated: false },
  { id: 't3', deviceName: 'Guest MacBook Pro', ip: '192.168.0.77',  type: 'Port Scan Detected',    detail: 'Swept ports 22, 80, 443, 8080 on 3 internal hosts',           level: 'high',     time: new Date(Date.now() - 1000*60*48).toISOString(), mitigated: false },
  { id: 't4', deviceName: 'IP Camera #3',      ip: '192.168.0.91',  type: 'Known CVE (CVE-2023-1)', detail: 'Hikvision firmware v3.2.1 — unauthenticated RCE vulnerability',level: 'critical', time: new Date(Date.now() - 1000*60*120).toISOString(),mitigated: true  },
  { id: 't5', deviceName: 'Starlink Router',   ip: '192.168.0.1',   type: 'Default Credentials',   detail: 'Admin interface reachable with default factory password',      level: 'high',     time: new Date(Date.now() - 1000*60*200).toISOString(),mitigated: true  },
];

const RISK_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 3389, 8080, 8443];

// Incident log
const mockIncidents: Incident[] = [
  {
    id: 'i1', title: 'Rogue Device Detected on Guest VLAN',
    description: 'Unknown MAC address B6:90:FA:FD:FE:D5 began probing internal hosts. Device has no hostname and is not registered in any allowlist.',
    severity: 'critical', status: 'investigating',
    opened: new Date(Date.now() - 1000*60*60*3).toISOString(),
    updated: new Date(Date.now() - 1000*60*18).toISOString(),
    assignee: 'NauticShield SOC', slaHours: 4,
  },
  {
    id: 'i2', title: 'Port Scan from Guest MacBook',
    description: 'Guest device 192.168.0.77 swept ports 22, 80, 443, 8080 on three internal hosts over a 2-minute window.',
    severity: 'high', status: 'contained',
    opened: new Date(Date.now() - 1000*60*60*27).toISOString(),
    updated: new Date(Date.now() - 1000*60*60*5).toISOString(),
    assignee: 'Alex Thompson', slaHours: 8,
  },
  {
    id: 'i3', title: 'Hikvision Camera CVE-2023-1 Detected',
    description: 'IP Camera #3 running firmware v3.2.1 is vulnerable to unauthenticated RCE. Camera isolated from main LAN pending firmware update.',
    severity: 'critical', status: 'resolved',
    opened: new Date(Date.now() - 1000*60*60*72).toISOString(),
    updated: new Date(Date.now() - 1000*60*60*48).toISOString(),
    assignee: 'NauticShield SOC', slaHours: 4,
  },
  {
    id: 'i4', title: 'Starlink Admin Panel Default Credentials',
    description: 'Starlink router admin interface accessible with default factory credentials. Password updated and remote management disabled.',
    severity: 'high', status: 'resolved',
    opened: new Date(Date.now() - 1000*60*60*120).toISOString(),
    updated: new Date(Date.now() - 1000*60*60*96).toISOString(),
    assignee: 'Alex Thompson', slaHours: 8,
  },
];

// Pen test schedule
const mockPenTests: PenTest[] = [
  {
    id: 'pt1', label: 'Annual Pen Test — Q1 2026', firm: 'CyberKeel Maritime Security',
    date: '2026-03-15', result: 'pass', score: 87, nextDue: '2027-03-15', reportRef: 'CK-2026-0315',
    findings: [
      { id: 'f1a', category: 'Network', title: 'RDP exposed on crew laptop', severity: 'high', description: 'Remote Desktop Protocol reachable from guest VLAN. Patched by disabling RDP and enforcing VPN-only remote access.', remediated: true },
      { id: 'f1b', category: 'Firmware', title: 'IP camera running end-of-life firmware', severity: 'medium', description: 'Hikvision camera on firmware v3.2.1 (EOL). Updated to v4.1.8 during engagement.', remediated: true },
    ],
  },
  {
    id: 'pt2', label: 'Annual Pen Test — Q1 2025', firm: 'CyberKeel Maritime Security',
    date: '2025-03-10', result: 'pass', score: 79, nextDue: '2026-03-10', reportRef: 'CK-2025-0310',
    findings: [
      { id: 'f2a', category: 'Access Control', title: 'Default credentials on NMEA gateway', severity: 'critical', description: 'Furuno NMEA 2000 gateway using factory default admin/admin credentials. Changed during engagement.', remediated: true },
      { id: 'f2b', category: 'Network Segmentation', title: 'Guest VLAN can reach navigation LAN', severity: 'high', description: 'ACL misconfiguration allowed inter-VLAN routing from guest Wi-Fi to navigation network. Firewall rule added.', remediated: true },
      { id: 'f2c', category: 'Patch Management', title: 'Unpatched Windows 10 on bridge PC', severity: 'medium', description: 'Bridge workstation 14 months behind on Windows updates. Auto-update enabled.', remediated: true },
      { id: 'f2d', category: 'Monitoring', title: 'No IDS/IPS on external-facing interfaces', severity: 'medium', description: 'Starlink interface lacked intrusion detection. NauticShield monitoring deployed.', remediated: true },
    ],
  },
  {
    id: 'pt3', label: 'Annual Pen Test — Q1 2024', firm: 'Security Innovation (SI)',
    date: '2024-03-08', result: 'fail', score: 52, nextDue: '2025-03-08', reportRef: 'SI-2024-YT-042',
    findings: [
      { id: 'f3a', category: 'Network', title: 'Unencrypted Telnet on satellite modem', severity: 'critical', description: 'VSAT modem management interface accessible via Telnet (plaintext). Remote attacker could intercept credentials. Replaced with SSH.', remediated: true },
      { id: 'f3b', category: 'Physical Security', title: 'Server room unlocked during engagement', severity: 'high', description: 'Engine control room with network switch found unlocked at 02:00 during social engineering test. Policy updated.', remediated: true },
      { id: 'f3c', category: 'Authentication', title: 'No MFA on any remote access', severity: 'high', description: 'Crew and management remote access relied solely on passwords. MFA enforced via Azure AD post-engagement.', remediated: true },
      { id: 'f3d', category: 'Network', title: 'AIS transponder on flat network', severity: 'high', description: 'AIS transponder on same broadcast domain as crew devices. Segmented into dedicated maritime VLAN.', remediated: true },
      { id: 'f3e', category: 'Monitoring', title: 'No centralised logging', severity: 'medium', description: 'No SIEM or log aggregation. Individual device logs not retained. Centralised syslog implemented.', remediated: false },
      { id: 'f3f', category: 'Patch Management', title: 'Multiple EOL software packages', severity: 'medium', description: '7 packages with known CVEs across bridge and crew systems. 5 of 7 remediated. 2 pending vendor patches.', remediated: false },
      { id: 'f3g', category: 'Encryption', title: 'Internal comms not encrypted in transit', severity: 'medium', description: 'HTTP used for internal web interfaces. Switched to self-signed TLS pending CA certificate procurement.', remediated: true },
    ],
  },
  {
    id: 'pt4', label: 'Annual Pen Test — Q2 2026', firm: 'TBD',
    date: '2026-06-01', result: 'scheduled', score: 0, nextDue: '2026-06-01', reportRef: '',
    findings: [],
  },
];

const PEN_TEST_STORAGE_KEY = 'nauticshield.penTestSchedule';

function addOneYear(date: string) {
  if (!date) return '';
  const next = new Date(`${date}T00:00:00`);
  next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}


// ── Maritime CVE Database ─────────────────────────────────────────

type CvssVector = 'Network' | 'Adjacent' | 'Physical';
type CveSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

interface MaritimeCVE {
  id:           string;  // CVE ID
  cvss:         number;  // 0-10
  severity:     CveSeverity;
  vector:       CvssVector;
  matchType:    string;  // matches Device.type
  matchMfr?:    string;  // optional manufacturer keyword (lowercase)
  title:        string;
  description:  string;
  affectedFw?:  string;  // affected firmware / version range
  remediation:  string;
  published:    string;  // YYYY-MM
  bimcoRef:     string;
}

const MARITIME_CVE_DB: MaritimeCVE[] = [
  // ── IP Cameras ────────────────────────────────────────────────
  { id:'CVE-2021-36260', cvss:9.8, severity:'Critical', vector:'Network',  matchType:'camera', matchMfr:'hikvision',  title:'Hikvision Command Injection — Unauthenticated RCE',       description:'A command injection vulnerability in the web server of Hikvision cameras allows an unauthenticated attacker to gain full control of the device over the network.',                        affectedFw:'≤V5.5.800',       remediation:'Update to firmware V5.5.800 or later via Hikvision SADP tool. Disable remote web access if not required.',             published:'2021-09', bimcoRef:'BIMCO §7.2' },
  { id:'CVE-2022-45868', cvss:8.8, severity:'High',     vector:'Network',  matchType:'camera', matchMfr:'hikvision',  title:'Hikvision Auth Bypass — Session Hijacking',               description:'Improper access control allows attacker on the same network to bypass authentication and hijack active sessions, gaining admin access.',                                               affectedFw:'≤V4.30.210',      remediation:'Apply security patch from Hikvision portal. Isolate cameras to a dedicated VLAN.',                                        published:'2022-11', bimcoRef:'BIMCO §3.2' },
  { id:'CVE-2023-28812', cvss:7.5, severity:'High',     vector:'Network',  matchType:'camera', matchMfr:'hikvision',  title:'Hikvision RTSP Heap Overflow — DoS / RCE',                description:'A heap buffer overflow in the RTSP service can be triggered remotely, causing denial of service or potential code execution.',                                                         affectedFw:'≤V5.7.0',         remediation:'Upgrade firmware. Restrict RTSP port 554 to authorised IPs only.',                                                        published:'2023-04', bimcoRef:'BIMCO §7.3' },
  { id:'CVE-2020-18931', cvss:9.1, severity:'Critical', vector:'Network',  matchType:'camera', matchMfr:'dahua',      title:'Dahua Authentication Bypass — Full Admin Access',         description:'Unauthenticated access to Dahua NVR/camera admin panel via crafted HTTP request. Attacker can view footage, change settings, and pivot to LAN.',                                   affectedFw:'Multiple',        remediation:'Apply Dahua DSA-2020 patch. Enable IP allowlist. Disable UPnP.',                                                         published:'2020-08', bimcoRef:'BIMCO §7.2' },
  { id:'CVE-2021-33044', cvss:9.8, severity:'Critical', vector:'Network',  matchType:'camera', matchMfr:'dahua',      title:'Dahua Identity Auth Bypass (Remote)',                     description:'The identity authentication of some Dahua devices can be bypassed by sending crafted data packets — no credentials required.',                                                         affectedFw:'See Dahua DSA-2021-017', remediation:'Update per Dahua security advisory DSA-2021-017.',                                                              published:'2021-10', bimcoRef:'BIMCO §7.2' },
  { id:'CVE-2018-10660', cvss:8.8, severity:'High',     vector:'Network',  matchType:'camera',                        title:'Generic ONVIF Command Injection',                          description:'Multiple IP camera vendors implement ONVIF without input sanitisation, allowing authenticated users to inject OS commands via crafted SOAP requests.',                                  affectedFw:'Various',         remediation:'Disable ONVIF if not required. Change default credentials. Segment cameras to OT VLAN.',                                   published:'2018-06', bimcoRef:'BIMCO §7.3' },
  { id:'CVE-2024-11013', cvss:7.2, severity:'High',     vector:'Network',  matchType:'camera',                        title:'IP Camera Default Credentials Exposure',                  description:'Camera admin panel reachable with vendor default credentials (admin/admin or admin/12345). Enables unauthorised surveillance and network pivot.',                                        affectedFw:'All unpatched',   remediation:'Change all default credentials immediately. Restrict camera admin ports to management VLAN.',                             published:'2024-01', bimcoRef:'BIMCO §3.2' },

  // ── Routers / Access Points ───────────────────────────────────
  { id:'CVE-2022-0778',  cvss:7.5, severity:'High',     vector:'Network',  matchType:'router', matchMfr:'starlink',   title:'OpenSSL Infinite Loop — Starlink / Peplink Affected',     description:'An infinite loop in OpenSSL certificate parsing can be triggered by a malicious certificate, causing a denial of service on the affected device.',                                   affectedFw:'OpenSSL <1.0.2zd', remediation:'Ensure router OS / firmware uses OpenSSL 1.0.2zd or later. Apply vendor patch.',                                         published:'2022-03', bimcoRef:'BIMCO §3.3' },
  { id:'CVE-2023-32784', cvss:7.1, severity:'High',     vector:'Adjacent', matchType:'router',                        title:'Wi-Fi Protected Management Frame Bypass',                 description:'Fragmentation and aggregation attacks allow an adjacent attacker to bypass Wi-Fi Protected Management Frames, enabling deauthentication and eavesdropping.',                          affectedFw:'802.11 pre-WPA3', remediation:'Enable WPA3 where supported. Enable PMF (Protected Management Frames). Update AP firmware.',                           published:'2023-05', bimcoRef:'BIMCO §7.3' },
  { id:'CVE-2022-27643', cvss:8.1, severity:'High',     vector:'Adjacent', matchType:'router', matchMfr:'ubiquiti',   title:'Ubiquiti UniFi SSRF — Internal Service Exposure',         description:'Server-side request forgery in the UniFi controller allows an authenticated attacker to reach internal services not otherwise accessible.',                                          affectedFw:'<6.5.55',         remediation:'Update UniFi controller to 6.5.55+. Restrict controller access to management VLAN.',                                       published:'2022-04', bimcoRef:'BIMCO §3.2' },
  { id:'CVE-2021-20090', cvss:9.8, severity:'Critical', vector:'Network',  matchType:'router', matchMfr:'peplink',    title:'Peplink/Pepwave Path Traversal — Auth Bypass',            description:'Path traversal vulnerability in Peplink router web interface allows unauthenticated access to configuration files and sensitive credentials.',                                       affectedFw:'<8.1.0s',         remediation:'Upgrade to Peplink firmware 8.1.0s or newer via InControl2 portal.',                                                     published:'2021-08', bimcoRef:'BIMCO §7.3' },
  { id:'CVE-2024-21887', cvss:9.1, severity:'Critical', vector:'Network',  matchType:'router',                        title:'Ivanti VPN / Network Appliance Command Injection',        description:'Command injection in web components of network appliances allows unauthenticated remote command execution. Widely exploited in maritime operator environments in 2024.',              affectedFw:'Various',         remediation:'Apply vendor patches. Perform IoC scan per vendor advisory. Rotate credentials.',                                        published:'2024-01', bimcoRef:'BIMCO §6.1' },
  { id:'CVE-2023-38831', cvss:7.8, severity:'High',     vector:'Network',  matchType:'router',                        title:'Router Firmware Supply Chain — Malicious Update',         description:'Insufficient signature verification on firmware updates allows a MITM attacker to push malicious firmware to routers lacking certificate pinning.',                                   affectedFw:'Multiple vendors', remediation:'Verify firmware signatures before applying. Use trusted update channels only. Disable automatic updates.',               published:'2023-08', bimcoRef:'BIMCO §7.1' },

  // ── Smart TVs ─────────────────────────────────────────────────
  { id:'CVE-2022-43940', cvss:6.5, severity:'Medium',   vector:'Adjacent', matchType:'tv', matchMfr:'samsung',        title:'Samsung Smart TV — Telemetry Data Exfiltration',          description:'Samsung TVs transmit viewing data to remote analytics servers even when ACR is disabled. On yacht networks this exposes guest and crew behaviour patterns.',                           affectedFw:'Tizen <6.0',      remediation:'Disable ACR in Settings. Block port 4443 outbound. Segment TVs to a guest VLAN.',                                         published:'2022-10', bimcoRef:'BIMCO §7.1' },
  { id:'CVE-2023-21089', cvss:7.4, severity:'High',     vector:'Adjacent', matchType:'tv', matchMfr:'samsung',        title:'Samsung Tizen OS — Local Privilege Escalation',           description:'A vulnerability in Tizen OS allows an attacker on the same network to escalate privileges and gain root access to the TV, enabling it as a surveillance pivot.',                    affectedFw:'Tizen <7.0',      remediation:'Update Samsung TV software to latest. Disable SSH and developer mode if enabled.',                                       published:'2023-01', bimcoRef:'BIMCO §7.2' },
  { id:'CVE-2022-29154', cvss:5.9, severity:'Medium',   vector:'Adjacent', matchType:'tv', matchMfr:'lg',             title:'LG webOS — Insecure Direct Object Reference',             description:'IDOR vulnerability in LG webOS allows unauthenticated access to the TV remote control API from the local network, enabling channel changes, volume control, and app launch.',      affectedFw:'webOS <6.2',      remediation:'Update webOS firmware. Disable TV app store remote access. Segment to guest VLAN.',                                       published:'2022-06', bimcoRef:'BIMCO §3.2' },
  { id:'CVE-2024-10148', cvss:8.2, severity:'High',     vector:'Network',  matchType:'tv', matchMfr:'lg',             title:'LG webOS Bypass — Unauthenticated Admin',                 description:'Multiple vulnerabilities (CVE-2024-10148 series) in LG webOS allow unauthenticated attackers to add privileged accounts and bypass OS-level PIN protection.',                     affectedFw:'webOS 4-7',       remediation:'Apply LG patch from March 2024. Enable automatic updates.',                                                             published:'2024-03', bimcoRef:'BIMCO §7.2' },
  { id:'CVE-2021-37533', cvss:6.8, severity:'Medium',   vector:'Adjacent', matchType:'tv',                            title:'Smart TV DLNA — Media Library Disclosure',                description:'DLNA/uPnP service on smart TVs exposes media library and device info to unauthenticated clients on the local network, leaking crew/guest file metadata.',                         affectedFw:'All with DLNA',   remediation:'Disable DLNA/uPnP or restrict with firewall rules. Segment TVs to guest VLAN.',                                         published:'2021-09', bimcoRef:'BIMCO §7.1' },

  // ── Laptops / Endpoints ───────────────────────────────────────
  { id:'CVE-2023-36884', cvss:8.8, severity:'High',     vector:'Network',  matchType:'laptop',                        title:'Microsoft Office / Windows — Remote Code Execution',      description:'Specially crafted Office documents can achieve RCE without user interaction when preview pane is enabled. Relevant for crew laptops receiving email attachments.',                   affectedFw:'Windows unpatched', remediation:'Apply Microsoft July 2023 patch (KB5028168). Disable preview pane in Outlook.',                                       published:'2023-07', bimcoRef:'BIMCO §6.1' },
  { id:'CVE-2024-30051', cvss:7.8, severity:'High',     vector:'Network',  matchType:'laptop',                        title:'Windows DWM Core — Local Privilege Escalation (0-day)',   description:'Zero-day vulnerability in Windows Desktop Window Manager exploited by Qakbot malware. Gives local user SYSTEM-level privileges.',                                                   affectedFw:'Win10/11 unpatched', remediation:'Apply Microsoft May 2024 patch. Deploy EDR capable of monitoring privilege escalation.',                                 published:'2024-05', bimcoRef:'BIMCO §6.1' },
  { id:'CVE-2023-23397', cvss:9.8, severity:'Critical', vector:'Network',  matchType:'laptop',                        title:'Microsoft Outlook — Zero-Click Credential Theft',         description:'Specially crafted Outlook reminders trigger NTLM hash leak without any user action, even before email is opened. Exploitable over LAN.',                                           affectedFw:'Outlook unpatched', remediation:'Apply MS March 2023 patch immediately. Deploy NTLM relay protections.',                                              published:'2023-03', bimcoRef:'BIMCO §6.1' },

  // ── Mobile / Phones ───────────────────────────────────────────
  { id:'CVE-2023-41064', cvss:7.8, severity:'High',     vector:'Adjacent', matchType:'phone',                         title:'Apple iOS — PassKit Blastpass (Zero-Click)',              description:'Zero-click exploit via PassKit/iMessage allows attacker on same network or via iMessage to gain code execution without any user interaction. Used to deliver Pegasus spyware.',   affectedFw:'<iOS 16.6.1',     remediation:'Update to iOS 16.6.1 or later. Enable Lockdown Mode for high-risk users.',                                               published:'2023-09', bimcoRef:'BIMCO §6.1' },
  { id:'CVE-2024-23204', cvss:6.5, severity:'Medium',   vector:'Adjacent', matchType:'phone',                         title:'Apple Shortcuts — File System Exfiltration',              description:'Malicious Shortcuts automations can access and exfiltrate sensitive files from the device without triggering the standard permission prompt.',                                      affectedFw:'<iOS 17.3',       remediation:'Update to iOS 17.3+. Review and remove untrusted Shortcuts automations.',                                               published:'2024-01', bimcoRef:'BIMCO §6.2' },

  // ── Unknown / Rogue devices ───────────────────────────────────
  { id:'CVE-2022-ROGUE',  cvss:9.9, severity:'Critical', vector:'Adjacent', matchType:'unknown',                      title:'Unregistered Device — Potential Network Pivot',           description:'An unrecognised device is active on the vessel network. Rogue devices are frequently used as initial access points for lateral movement and data exfiltration.',                   affectedFw:'Unknown',         remediation:'Immediately isolate device at the switch port. Identify via MAC OUI lookup. Do not allow unknown devices to roam.',       published:'2022-01', bimcoRef:'BIMCO §7.1' },
];

// Match CVEs to a device
function matchCVEs(device: Device): MaritimeCVE[] {
  const mfr = (device.manufacturer || '').toLowerCase();
  return MARITIME_CVE_DB.filter(cve =>
    cve.matchType === device.type &&
    (!cve.matchMfr || mfr.includes(cve.matchMfr))
  ).sort((a, b) => b.cvss - a.cvss);
}

// Generate isolate CLI command for a device IP
function isolateCLI(ip: string): { iptables: string; pfsense: string; openwrt: string } {
  return {
    iptables: `iptables -I FORWARD -s ${ip} -j DROP && iptables -I FORWARD -d ${ip} -j DROP`,
    pfsense:  `pfctl -t isolate -T add ${ip}  # Pre-configure an isolation table in pfSense`,
    openwrt:  `iptables -I FORWARD -s ${ip} -j DROP\niptables -I FORWARD -d ${ip} -j DROP`,
  };
}

// Device protection coverage (built from live devices)
function buildProtection(devices: Device[]): DeviceProtection[] {
  return devices.map(d => {
    const seed = Array.from(d.mac || d.id).reduce((a, c) => a + c.charCodeAt(0), 0);
    const edr       = d.type !== 'unknown' && (seed % 3) !== 0;
    const epp       = d.type !== 'unknown' && (seed % 4) !== 0;
    const encrypted = d.type !== 'unknown' && (seed % 5) !== 0;
    const status: ProtectionStatus =
      (!edr && !epp) ? 'unprotected' :
      (!edr || !epp) ? 'partial' : 'protected';
    return { deviceId: d.id, name: d.name, ip: d.ip, type: d.type, edr, epp, encrypted, status };
  });
}

function buildScanResults(devices: Device[]): ScanResult[] {
  return devices.filter(d => d.status === 'online').map(d => {
    const seed = Array.from(d.mac || '').reduce((a, c) => a + c.charCodeAt(0), 0);
    const openPorts = RISK_PORTS.filter((_, i) => ((seed + i * 7) % 5) === 0);
    const riskPorts = openPorts.filter(p => [23, 3389, 445, 135, 139].includes(p));
    return {
      id: d.id,
      deviceId: d.id,
      deviceName: d.name,
      ip: d.ip,
      openPorts,
      riskPorts,
      manufacturer: d.manufacturer || 'Unknown',
      flagged: riskPorts.length > 0 || d.type === 'unknown',
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const threatConfig: Record<ThreatLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)'  },
  high:     { label: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
  medium:   { label: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  low:      { label: 'Low',      color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.3)' },
  clear:    { label: 'Clear',    color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)'  },
};

// ── Card shell ────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#4a5a6a', marginBottom: 14 }}>
      {children}
    </div>
  );
}

function PremiumBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`,
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>
      ✦ Premium
    </span>
  );
}

const CYBER_SECTIONS = [
  { id: 'cyber-overview', label: 'Overview' },
  { id: 'cyber-scanning', label: 'Scanning' },
  { id: 'cyber-incidents', label: 'Incidents' },
  { id: 'cyber-pen-tests', label: 'Pen Tests' },
  { id: 'cyber-coverage', label: 'Coverage' },
  { id: 'cyber-recommendations', label: 'Recommendations' },
] as const;

function CyberSectionNav() {
  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <Card style={{ padding: 12, position: 'sticky', top: 12, zIndex: 5, background: 'rgba(13,20,33,0.94)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ color: '#4a5a6a', fontSize: 10, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', marginRight: 4 }}>
          Jump to
        </span>
        {CYBER_SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => jumpTo(section.id)}
            style={{
              background: '#0a0f18',
              color: '#a8b9c8',
              border: '1px solid #1a2535',
              borderRadius: 999,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Threat Score Ring ─────────────────────────────────────────────

function ThreatRing({ score }: { score: number }) {
  const r = 54, cx = 62, cy = 62;
  const circumference = 2 * Math.PI * r;
  const danger = 100 - score; // higher danger = worse
  const color  = danger < 20 ? '#22c55e' : danger < 50 ? '#f59e0b' : '#ef4444';
  const label  = danger < 20 ? 'Secure' : danger < 50 ? 'Elevated' : 'At Risk';
  const offset = circumference * (1 - danger / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={124} height={124}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2535" strokeWidth={10} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={22} fontWeight={800}>{danger}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#6b7f92" fontSize={11}>{label}</text>
      </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, color: '#8899aa' }}>Threat exposure score</div>
        <div style={{ fontSize: 11, color: '#4a5a6a' }}>Updated every 30s</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {[
            { label: 'Rogue devices',    val: mockThreats.filter(t => t.type === 'Rogue Device'  && !t.mitigated).length, c: '#ef4444' },
            { label: 'Active CVEs',      val: mockThreats.filter(t => t.type.includes('CVE')     && !t.mitigated).length, c: '#f97316' },
            { label: 'Anomalies',        val: mockThreats.filter(t => !t.mitigated).length,                                c: '#f59e0b' },
          ].map(({ label, val, c }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ color: '#6b7f92', fontSize: 11 }}>{label}</span>
              <span style={{ color: val > 0 ? c : '#22c55e', fontWeight: 700, fontSize: 12, marginLeft: 'auto' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Threat feed row ───────────────────────────────────────────────

function ThreatRow({ threat, onMitigate }: { threat: ThreatEntry; onMitigate: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const c = threatConfig[threat.level];

  return (
    <div style={{
      background: '#0a0f18',
      border: `1px solid ${threat.mitigated ? '#1a2535' : c.border}`,
      borderLeft: `3px solid ${threat.mitigated ? '#1a2535' : c.color}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: threat.mitigated ? 'rgba(34,197,94,0.1)' : c.bg }}>
          {threat.mitigated ? <ShieldCheck size={15} color="#22c55e" /> : <ShieldAlert size={15} color={c.color} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ background: threat.mitigated ? 'rgba(34,197,94,0.1)' : c.bg, color: threat.mitigated ? '#22c55e' : c.color, border: `1px solid ${threat.mitigated ? 'rgba(34,197,94,0.3)' : c.border}`, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
              {threat.mitigated ? 'Mitigated' : c.label}
            </span>
            <span style={{ color: '#6b7f92', fontSize: 11, fontFamily: 'monospace' }}>{threat.type}</span>
          </div>
          <div style={{ color: threat.mitigated ? '#6b7f92' : '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{threat.deviceName} — {threat.ip}</div>
          <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>{timeAgo(threat.time)}</div>
        </div>
        <div style={{ color: '#4a5a6a', flexShrink: 0 }}>{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</div>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #1a2535', padding: '12px 16px 14px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <span style={{ color: '#8899aa', fontSize: 13, lineHeight: 1.6 }}>{threat.detail}</span>
          {!threat.mitigated && (
            <button
              onClick={() => onMitigate(threat.id)}
              style={{ flexShrink: 0, background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Mitigate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Port scan table ───────────────────────────────────────────────

function PortScanTable({ results }: { results: ScanResult[] }) {
  const flagged = results.filter(r => r.flagged);
  const clean   = results.filter(r => !r.flagged);

  return (
    <Card>
      <CardLabel>Port Exposure Scan — {results.length} devices</CardLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[...flagged, ...clean].map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#080b10',
            border: `1px solid ${r.flagged ? 'rgba(249,115,22,0.2)' : '#1a2535'}`,
            borderRadius: 10, padding: '10px 14px',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.flagged ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.07)', flexShrink: 0 }}>
              {r.flagged ? <ShieldX size={13} color="#f97316" /> : <ShieldCheck size={13} color="#22c55e" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{r.deviceName}</div>
              <div style={{ color: '#4a5a6a', fontSize: 11, fontFamily: 'monospace' }}>{r.ip} · {r.manufacturer}</div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
              {r.openPorts.length === 0 && (
                <span style={{ color: '#22c55e', fontSize: 11 }}>No open ports</span>
              )}
              {r.openPorts.map(p => (
                <span key={p} style={{
                  background: r.riskPorts.includes(p) ? 'rgba(249,115,22,0.12)' : 'rgba(14,165,233,0.08)',
                  color: r.riskPorts.includes(p) ? '#f97316' : '#7dd3fc',
                  border: `1px solid ${r.riskPorts.includes(p) ? 'rgba(249,115,22,0.3)' : 'rgba(14,165,233,0.2)'}`,
                  borderRadius: 5, padding: '1px 7px', fontSize: 11, fontFamily: 'monospace',
                }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Firewall rules ────────────────────────────────────────────────

function FirewallPanel({ rules, onToggle }: { rules: FirewallRule[]; onToggle: (id: string) => void }) {
  return (
    <Card>
      <CardLabel>Firewall Rules — {rules.filter(r => r.enabled).length} active</CardLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rules.map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#080b10', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 14px',
            opacity: r.enabled ? 1 : 0.45,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.action === 'block' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)', flexShrink: 0 }}>
              {r.action === 'block' ? <Lock size={13} color="#ef4444" /> : <Unlock size={13} color="#22c55e" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{r.name}</div>
              <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 1 }}>
                {r.direction} · port {r.port} · {r.protocol}
              </div>
            </div>
            <span style={{ background: r.action === 'block' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)', color: r.action === 'block' ? '#ef4444' : '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
              {r.action.toUpperCase()}
            </span>
            <button
              onClick={() => onToggle(r.id)}
              style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0,
                background: r.enabled ? '#22c55e' : '#1a2535', position: 'relative', flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                background: '#f0f4f8',
                left: r.enabled ? 18 : 2,
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Traffic monitor ───────────────────────────────────────────────

function TrafficMonitor() {
  const [masked, setMasked] = useState(true);
  const samples = [38, 52, 41, 67, 55, 49, 72, 61, 44, 58, 65, 53, 70, 48, 56, 62, 75, 59, 43, 68, 57, 50, 64, 71];
  const max = Math.max(...samples);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <CardLabel>Traffic Anomaly Monitor</CardLabel>
        <button
          onClick={() => setMasked(m => !m)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #1a2535', borderRadius: 8, padding: '4px 10px', color: '#6b7f92', fontSize: 11, cursor: 'pointer' }}
        >
          {masked ? <Eye size={12} /> : <EyeOff size={12} />}
          {masked ? 'Reveal IPs' : 'Mask IPs'}
        </button>
      </div>

      {/* Sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, marginBottom: 16 }}>
        {samples.map((v, i) => {
          const h = Math.max(4, Math.round((v / max) * 54));
          const isSpike = v > 68;
          return (
            <div key={i} style={{ flex: 1, height: h, borderRadius: 3, background: isSpike ? '#ef4444' : 'rgba(14,165,233,0.35)', transition: 'height 0.3s' }} title={`${v} Mbps`} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5a6a', fontSize: 10, marginBottom: 14 }}>
        <span>24h ago</span><span>Now</span>
      </div>

      {/* Anomaly rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { name: masked ? '192.168.0.██' : '192.168.0.138', label: 'High outbound to 104.21.x', spike: '74 Mbps', color: '#ef4444' },
          { name: masked ? '192.168.0.██' : '192.168.0.77',  label: 'Repeated DNS queries (>200/min)', spike: '71 Mbps', color: '#f97316' },
        ].map(r => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#080b10', borderRadius: 10, padding: '9px 13px', borderLeft: `3px solid ${r.color}` }}>
            <Flame size={13} color={r.color} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 500 }}>{r.name} — {r.label}</div>
            </div>
            <span style={{ color: r.color, fontSize: 12, fontWeight: 700 }}>{r.spike}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Incident log ─────────────────────────────────────────────────

const incidentStatusConfig: Record<IncidentStatus, { label: string; color: string; bg: string }> = {
  open:          { label: 'Open',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
  investigating: { label: 'Investigating', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  contained:     { label: 'Contained',     color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
  resolved:      { label: 'Resolved',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
};

function slaHoursElapsed(opened: string) {
  return Math.floor((Date.now() - new Date(opened).getTime()) / (1000 * 60 * 60));
}

function IncidentLog({ incidents, onUpdateStatus }: { incidents: Incident[]; onUpdateStatus: (id: string, s: IncidentStatus) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const active = incidents.filter(i => i.status !== 'resolved');
  const resolved = incidents.filter(i => i.status === 'resolved');

  function IncidentRow({ inc }: { inc: Incident }) {
    const elapsed  = slaHoursElapsed(inc.opened);
    const slaBreached = elapsed > inc.slaHours && inc.status !== 'resolved';
    const sc = incidentStatusConfig[inc.status];
    const expanded = open === inc.id;
    const nextStatuses: IncidentStatus[] = inc.status === 'open' ? ['investigating'] :
      inc.status === 'investigating' ? ['contained', 'resolved'] :
      inc.status === 'contained' ? ['resolved'] : [];

    return (
      <div style={{
        background: '#0a0f18',
        border: `1px solid ${slaBreached ? 'rgba(239,68,68,0.3)' : '#1a2535'}`,
        borderLeft: `3px solid ${sc.color}`,
        borderRadius: 12, overflow: 'hidden',
      }}>
        <button
          onClick={() => setOpen(expanded ? null : inc.id)}
          style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sc.bg }}>
            <ClipboardList size={15} color={sc.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>{sc.label}</span>
              {slaBreached && (
                <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
                  SLA BREACHED +{elapsed - inc.slaHours}h
                </span>
              )}
              <span style={{ color: '#4a5a6a', fontSize: 11 }}>SLA: {inc.slaHours}h · {elapsed}h elapsed</span>
            </div>
            <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{inc.title}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
              <span style={{ color: '#4a5a6a', fontSize: 11 }}>Assignee: {inc.assignee}</span>
              <span style={{ color: '#4a5a6a', fontSize: 11 }}>Updated: {timeAgo(inc.updated)}</span>
            </div>
          </div>
          <div style={{ color: '#4a5a6a', flexShrink: 0 }}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</div>
        </button>
        {expanded && (
          <div style={{ borderTop: '1px solid #1a2535', padding: '12px 16px 14px 60px' }}>
            <p style={{ color: '#8899aa', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>{inc.description}</p>
            {nextStatuses.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {nextStatuses.map(s => (
                  <button key={s} onClick={() => onUpdateStatus(inc.id, s)} style={{
                    background: incidentStatusConfig[s].bg, color: incidentStatusConfig[s].color,
                    border: `1px solid ${incidentStatusConfig[s].color}40`, borderRadius: 8,
                    padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    Mark {incidentStatusConfig[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <CardLabel>Incident Log — {active.length} active</CardLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['open','investigating','contained'] as IncidentStatus[]).map(s => {
            const count = incidents.filter(i => i.status === s).length;
            if (!count) return null;
            const c = incidentStatusConfig[s];
            return <span key={s} style={{ background: c.bg, color: c.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{count} {c.label}</span>;
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...active, ...resolved].map(i => <IncidentRow key={i.id} inc={i} />)}
      </div>
    </Card>
  );
}

// ── Pen test schedule ─────────────────────────────────────────────

// ── Pen test checks definition ───────────────────────────────────

type CheckStatus = 'pass' | 'warn' | 'fail';
type PenCheckResult = {
  category: string;
  check:    string;
  status:   CheckStatus;
  detail:   string;
  weight:   number; // 1-3, higher = more impact on score
  bimcoRef: string;  // e.g. 'BIMCO §7.3'
  imoRef:   string;  // e.g. 'MSC-FAL.1 Elm.1'
};

function scoreScanResults(
  devices: Device[],
  scanResults: ScanResult[],
  threats: ThreatEntry[],
  fwRules: FirewallRule[],
  incidents: Incident[],
): { checks: PenCheckResult[]; score: number } {
  const checks: PenCheckResult[] = [];

  // Network exposure
  const riskDevices = scanResults.filter(r => r.riskPorts.length > 0);
  checks.push({
    category: 'Network Exposure',
    check:    'High-risk ports (Telnet, RDP, SMB, WinRM)',
    status:   riskDevices.length === 0 ? 'pass' : riskDevices.length <= 1 ? 'warn' : 'fail',
    detail:   riskDevices.length === 0 ? 'No high-risk ports exposed on any device.' : `${riskDevices.length} device(s) with risky ports: ${riskDevices.map(d => d.deviceName).join(', ')}.`,
    weight:   3,
    bimcoRef: 'BIMCO §7.3',
    imoRef:   'MSC-FAL.1 Elm.1',
  });
  const openPortDevices = scanResults.filter(r => r.openPorts.length > 3);
  checks.push({
    category: 'Network Exposure',
    check:    'Unnecessarily open ports',
    status:   openPortDevices.length === 0 ? 'pass' : openPortDevices.length <= 2 ? 'warn' : 'fail',
    detail:   openPortDevices.length === 0 ? 'Devices have minimal port exposure.' : `${openPortDevices.length} device(s) have >3 open ports.`,
    weight:   2,
    bimcoRef: 'BIMCO §7.3',
    imoRef:   'MSC-FAL.1 Elm.1',
  });

  // Threat posture
  const activeThreats = threats.filter(t => !t.mitigated && (t.level === 'critical' || t.level === 'high'));
  checks.push({
    category: 'Threat Posture',
    check:    'Unmitigated critical/high threats',
    status:   activeThreats.length === 0 ? 'pass' : activeThreats.length <= 1 ? 'warn' : 'fail',
    detail:   activeThreats.length === 0 ? 'All high-severity threats mitigated.' : `${activeThreats.length} unmitigated threat(s): ${activeThreats.map(t => t.type).join(', ')}.`,
    weight:   3,
    bimcoRef: 'BIMCO §6.1',
    imoRef:   'MSC-FAL.1 Elm.3',
  });
  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'investigating');
  checks.push({
    category: 'Threat Posture',
    check:    'Open security incidents',
    status:   openIncidents.length === 0 ? 'pass' : openIncidents.length <= 1 ? 'warn' : 'fail',
    detail:   openIncidents.length === 0 ? 'No open incidents.' : `${openIncidents.length} incident(s) still open or under investigation.`,
    weight:   2,
    bimcoRef: 'BIMCO §6.2',
    imoRef:   'MSC-FAL.1 Elm.4',
  });

  // Firewall hygiene
  const blockRules     = fwRules.filter(r => r.action === 'block' && r.enabled);
  const disabledRules  = fwRules.filter(r => !r.enabled);
  checks.push({
    category: 'Firewall & Access Control',
    check:    'Active block rules',
    status:   blockRules.length >= 2 ? 'pass' : blockRules.length === 1 ? 'warn' : 'fail',
    detail:   `${blockRules.length} active block rule(s) configured.`,
    weight:   2,
    bimcoRef: 'BIMCO §3.2',
    imoRef:   'MSC-FAL.1 Elm.2',
  });
  checks.push({
    category: 'Firewall & Access Control',
    check:    'Disabled firewall rules',
    status:   disabledRules.length === 0 ? 'pass' : disabledRules.length <= 1 ? 'warn' : 'fail',
    detail:   disabledRules.length === 0 ? 'All rules enabled.' : `${disabledRules.length} rule(s) currently disabled — review intent.`,
    weight:   1,
    bimcoRef: 'BIMCO §3.2',
    imoRef:   'MSC-FAL.1 Elm.2',
  });

  // Device hygiene
  const flagged = scanResults.filter(r => r.flagged);
  checks.push({
    category: 'Device Hygiene',
    check:    'Unrecognised / flagged devices',
    status:   flagged.length === 0 ? 'pass' : 'fail',
    detail:   flagged.length === 0 ? 'No unrecognised devices on network.' : `${flagged.length} flagged device(s) detected.`,
    weight:   3,
    bimcoRef: 'BIMCO §7.1',
    imoRef:   'MSC-FAL.1 Elm.1',
  });
  checks.push({
    category: 'Device Hygiene',
    check:    'Device inventory completeness',
    status:   devices.length >= 5 ? 'pass' : 'warn',
    detail:   `${devices.length} device(s) registered in inventory.`,
    weight:   1,
    bimcoRef: 'BIMCO §7.1',
    imoRef:   'MSC-FAL.1 Elm.1',
  });

  // Connectivity resilience
  checks.push({
    category: 'Connectivity Resilience',
    check:    'Multi-provider failover configured',
    status:   devices.some(d => (d as any).provider !== (devices[0] as any)?.provider) ? 'pass' : 'warn',
    detail:   'Verify dual-provider (Starlink + LTE) failover is tested regularly.',
    weight:   1,
    bimcoRef: 'BIMCO §3.3',
    imoRef:   'MSC-FAL.1 Elm.5',
  });
  checks.push({
    category: 'Connectivity Resilience',
    check:    'DNS-over-HTTPS or encrypted DNS',
    status:   'warn',
    detail:   'Encrypted DNS not verifiable from current telemetry — confirm in router settings.',
    weight:   1,
    bimcoRef: 'BIMCO §3.2',
    imoRef:   'MSC-FAL.1 Elm.2',
  });

  // Compute weighted score
  const total  = checks.reduce((s, c) => s + c.weight * 2, 0); // max = weight*2 (pass=2, warn=1, fail=0)
  const earned = checks.reduce((s, c) => s + c.weight * (c.status === 'pass' ? 2 : c.status === 'warn' ? 1 : 0), 0);
  const score  = Math.round((earned / total) * 100);

  return { checks, score };
}

function exportPenTestPDF(score: number, checks: PenCheckResult[], scanResults: ScanResult[]) {
  const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const DARK    = [8,  11, 16]  as [number,number,number];
  const PANEL   = [13, 20, 33]  as [number,number,number];
  const GOLD_C  = [212,168,71]  as [number,number,number];
  const WHITE   = [240,244,248] as [number,number,number];
  const GREY    = [74,  90,106] as [number,number,number];
  const GREEN   = [34, 197, 94] as [number,number,number];
  const AMBER   = [245,158, 11] as [number,number,number];
  const RED     = [239, 68, 68] as [number,number,number];
  const pageW   = 210;

  // Header bar
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setFillColor(...GOLD_C);
  doc.rect(0, 38, pageW, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text('NauticShield', 14, 17);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GOLD_C);
  doc.text('Security Scan', 14, 25);
  doc.setTextColor(...GREY as [number,number,number]);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}`, 14, 33);

  // Compliance score box
  const scoreColor = score >= 80 ? GREEN : score >= 60 ? AMBER : RED;
  doc.setFillColor(...PANEL);
  doc.roundedRect(14, 46, 58, 32, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...scoreColor);
  doc.text(`${score}%`, 43, 67, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY as [number,number,number]);
  doc.text('COMPLIANCE SCORE', 43, 74, { align: 'center' });

  // Summary stats
  const passCt = checks.filter(c => c.status === 'pass').length;
  const warnCt = checks.filter(c => c.status === 'warn').length;
  const failCt = checks.filter(c => c.status === 'fail').length;
  const stats = [
    { label: 'Passed',   value: String(passCt), color: GREEN },
    { label: 'Warnings', value: String(warnCt), color: AMBER },
    { label: 'Failed',   value: String(failCt), color: RED   },
  ];
  stats.forEach(({ label, value, color }, i) => {
    const x = 80 + i * 44;
    doc.setFillColor(...PANEL);
    doc.roundedRect(x, 46, 38, 32, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...color);
    doc.text(value, x + 19, 65, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GREY as [number,number,number]);
    doc.text(label, x + 19, 73, { align: 'center' });
  });

  // Rating label
  const rating = score >= 80 ? 'Good — maintain current controls' : score >= 60 ? 'Fair — address warnings promptly' : 'Poor — immediate remediation required';
  doc.setFillColor(...scoreColor);
  doc.rect(14, 83, pageW - 28, 0.8, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...scoreColor);
  doc.text(rating, 14, 91);

  // Checks table
  autoTable(doc, {
    startY:  96,
    margin:  { left: 14, right: 14 },
    head:    [['Category', 'Check', 'Result', 'Detail', 'BIMCO', 'IMO Ref']],
    body:    checks.map(c => [c.category, c.check, c.status.toUpperCase(), c.detail, c.bimcoRef, c.imoRef]),
    styles:  { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: WHITE, fillColor: PANEL },
    headStyles:     { fillColor: [22, 33, 52] as [number,number,number], textColor: GOLD_C, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [10, 15, 24] as [number,number,number] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 52 },
      2: { cellWidth: 14 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 20 },
      5: { cellWidth: 22 },
    },
    didParseCell(data) {
      if (data.column.index === 2 && data.section === 'body') {
        const v = data.cell.raw as string;
        data.cell.styles.textColor = v === 'PASS' ? GREEN : v === 'WARN' ? AMBER : RED;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Port scan section
  const finalY = (doc as any).lastAutoTable?.finalY ?? 160;
  if (finalY < 240) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD_C);
    doc.text('Port Exposure Summary', 14, finalY + 10);
    autoTable(doc, {
      startY:  finalY + 14,
      margin:  { left: 14, right: 14 },
      head:    [['Device', 'IP', 'Open Ports', 'Risk Ports']],
      body:    scanResults.map(r => [r.deviceName, r.ip, r.openPorts.join(', ') || 'None', r.riskPorts.join(', ') || 'None']),
      styles:  { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: WHITE, fillColor: PANEL },
      headStyles: { fillColor: [22, 33, 52] as [number,number,number], textColor: GOLD_C, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [10, 15, 24] as [number,number,number] },
      didParseCell(data) {
        if (data.column.index === 3 && data.section === 'body') {
          const v = data.cell.raw as string;
          if (v !== 'None') data.cell.styles.textColor = RED;
        }
      },
    });
  }

  // Footer
  const pgH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...DARK);
  doc.rect(0, pgH - 14, pageW, 14, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...GREY as [number,number,number]);
  doc.text('CONFIDENTIAL — NauticShield Security Assessment. For internal use only.', pageW / 2, pgH - 5, { align: 'center' });

  doc.save(`NauticShield-Security-Assessment-${new Date().toISOString().slice(0,10)}.pdf`);
}


function exportEngagementBrief(
  pastScores: { runAt: string; score: number }[],
  dbFindings: CyberFinding[],
  penTests:   PenTest[],
) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const DARK   = [8,  11, 16]  as [number,number,number];
  const PANEL  = [13, 20, 33]  as [number,number,number];
  const GOLD_C = [212,168,71]  as [number,number,number];
  const WHITE  = [240,244,248] as [number,number,number];
  const GREY   = [74,  90,106] as [number,number,number];
  const GREEN  = [34, 197, 94] as [number,number,number];
  const RED    = [239, 68, 68] as [number,number,number];
  // const BLUE   = [14, 165,233] as [number,number,number];
  const pageW  = 210;
  const today  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Cover page ──────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 297, 'F');
  doc.setFillColor(...GOLD_C);
  doc.rect(0, 0, 4, 297, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text('NauticShield', 18, 60);
  doc.setFontSize(13);
  doc.setTextColor(...GOLD_C);
  doc.text('Pre-Engagement Security Brief', 18, 72);
  doc.setFillColor(...GOLD_C);
  doc.rect(18, 77, pageW - 36, 0.8, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY);
  doc.text('Prepared for: External Penetration Testing Firm', 18, 88);
  doc.text(`Date: ${today}`, 18, 95);
  doc.text('Classification: CONFIDENTIAL', 18, 102);

  // Purpose block
  doc.setFillColor(...PANEL);
  doc.roundedRect(18, 115, pageW - 36, 50, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD_C);
  doc.text('PURPOSE OF THIS BRIEF', 26, 126);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...WHITE);
  const purposeLines = doc.splitTextToSize(
    "This document provides essential context for an upcoming external penetration test of the vessel's onboard network and systems. It summarises the current security posture, historical assessment scores, open remediation items, and proposed engagement scope in line with BIMCO Cyber Security Guidelines (2nd Ed.) and IMO MSC-FAL.1/Circ.3 functional elements.",
    pageW - 52
  );
  doc.setFontSize(9);
  doc.text(purposeLines, 26, 134);

  // IMO / BIMCO reference
  doc.setFillColor(0, 0, 0, 0);
  doc.setDrawColor(...GOLD_C);
  doc.setLineWidth(0.4);
  doc.roundedRect(18, 175, pageW - 36, 28, 3, 3, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD_C);
  doc.text('REGULATORY FRAMEWORK', 26, 184);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY);
  doc.text('IMO MSC-FAL.1/Circ.3 — Guidelines on Maritime Cyber Risk Management', 26, 191);
  doc.text('BIMCO Cyber Security Guidelines for Ships (2nd Edition, 2021)', 26, 197);
  doc.text('IACS UR E26/E27 — Cyber Resilience for New Builds and Existing Ships', 26, 203);

  // Footer
  doc.setFillColor(...DARK);
  doc.rect(0, 283, pageW, 14, 'F');
  doc.setFillColor(...GOLD_C);
  doc.rect(0, 281, pageW, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text('NauticShield — Pre-Engagement Brief — CONFIDENTIAL', pageW / 2, 291, { align: 'center' });

  // ── Page 2: Current posture ─────────────────────────────────
  doc.addPage();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFillColor(...GOLD_C);
  doc.rect(0, 18, pageW, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text('Section 1 — Current Security Posture', 14, 13);

  let y = 28;

  // Score history
  if (pastScores.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD_C);
    doc.text('Quick Assessment Score History', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head:   [['Date', 'Score', 'Rating']],
      body:   pastScores.slice().reverse().map(s => [
        new Date(s.runAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        `${s.score}%`,
        s.score >= 80 ? 'Good' : s.score >= 60 ? 'Fair' : 'Poor',
      ]),
      styles:     { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: WHITE, fillColor: PANEL },
      headStyles: { fillColor: [22, 33, 52] as [number,number,number], textColor: GOLD_C, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [10, 15, 24] as [number,number,number] },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 'auto' } },
      didParseCell(data) {
        if (data.column.index === 2 && data.section === 'body') {
          const v = data.cell.raw as string;
          (data.cell.styles as any).textColor = v === 'Good' ? GREEN : v === 'Fair' ? [245,158,11] as [number,number,number] : RED;
        }
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 10;
  }

  // Open DB findings
  const openFindings = dbFindings.filter(f => f.findingStatus === 'open');
  if (openFindings.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD_C);
    doc.text(`Open Automated Findings (${openFindings.length})`, 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head:   [['Category', 'Check', 'Status', 'Detail', 'BIMCO', 'IMO']],
      body:   openFindings.map(f => [f.category, f.check_name, f.status.toUpperCase(), f.detail, '', (f as any).imoRef ?? '']),
      styles:     { font: 'helvetica', fontSize: 7, cellPadding: 2.5, textColor: WHITE, fillColor: PANEL },
      headStyles: { fillColor: [22, 33, 52] as [number,number,number], textColor: GOLD_C, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [10, 15, 24] as [number,number,number] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 44 }, 2: { cellWidth: 14 }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 18 }, 5: { cellWidth: 20 } },
      didParseCell(data) {
        if (data.column.index === 2 && data.section === 'body') {
          const v = data.cell.raw as string;
          (data.cell.styles as any).textColor = v === 'FAIL' ? RED : v === 'WARN' ? [245,158,11] as [number,number,number] : GREEN;
          (data.cell.styles as any).fontStyle = 'bold';
        }
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 30) + 10;
  }

  // ── Page 3: Pen test history + scope ───────────────────────
  doc.addPage();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFillColor(...GOLD_C);
  doc.rect(0, 18, pageW, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text('Section 2 — Professional Pen Test History', 14, 13);

  y = 28;
  const completedTests = penTests.filter(t => t.result !== 'scheduled');
  if (completedTests.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head:   [['Test', 'Firm', 'Date', 'Score', 'Result', 'Findings', 'Open']],
      body:   completedTests.map(t => [
        t.label,
        t.firm,
        new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        `${t.score}%`,
        t.result.toUpperCase(),
        t.findings.length,
        t.findings.filter(f => !f.remediated).length,
      ]),
      styles:     { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: WHITE, fillColor: PANEL },
      headStyles: { fillColor: [22, 33, 52] as [number,number,number], textColor: GOLD_C, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [10, 15, 24] as [number,number,number] },
      columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 26 }, 2: { cellWidth: 24 }, 3: { cellWidth: 16 }, 4: { cellWidth: 16 }, 5: { cellWidth: 16 }, 6: { cellWidth: 'auto' } },
      didParseCell(data) {
        if (data.column.index === 4 && data.section === 'body') {
          const v = data.cell.raw as string;
          (data.cell.styles as any).textColor = v === 'PASS' ? GREEN : RED;
          (data.cell.styles as any).fontStyle = 'bold';
        }
        if (data.column.index === 6 && data.section === 'body') {
          const v = Number(data.cell.raw);
          if (v > 0) (data.cell.styles as any).textColor = RED;
        }
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 30) + 12;
  }

  // Suggested scope
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD_C);
  doc.text('Section 3 — Proposed Engagement Scope', 14, y);
  y += 6;

  const scopeItems = [
    ['External Network', 'BIMCO §8', 'MSC-FAL.1 Elm.1', 'External perimeter test of Starlink gateway and satellite modem interface. Assess exposed ports and services visible from the internet.'],
    ['Wi-Fi VLAN Segmentation', 'BIMCO §7', 'MSC-FAL.1 Elm.2', 'Validate guest VLAN isolation from crew and OT networks. Test for cross-VLAN access using common pivot techniques.'],
    ['OT/Navigation Systems', 'BIMCO §7.2', 'MSC-FAL.1 Elm.1', 'Passive review of NMEA 0183/2000 data bus exposure. Confirm chartplotter/AIS is isolated from guest-accessible networks.'],
    ['Device Credential Audit', 'BIMCO §3.2', 'MSC-FAL.1 Elm.2', 'Test for default credentials on IP cameras, Starlink admin interface, managed switches and IoT endpoints.'],
    ['Phishing Simulation', 'BIMCO §6', 'MSC-FAL.1 Elm.3', 'Optional: spear-phishing exercise targeting crew devices to assess email security controls and user awareness.'],
    ['Physical Access', 'BIMCO §9', 'MSC-FAL.1 Elm.2', 'Inspect physical access to network switch ports and server room. Verify USB boot-lock on shore-side workstations.'],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head:   [['Area', 'BIMCO', 'IMO', 'Description']],
    body:   scopeItems,
    styles:     { font: 'helvetica', fontSize: 7.5, cellPadding: 3, textColor: WHITE, fillColor: PANEL },
    headStyles: { fillColor: [22, 33, 52] as [number,number,number], textColor: GOLD_C, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [10, 15, 24] as [number,number,number] },
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 20 }, 2: { cellWidth: 22 }, 3: { cellWidth: 'auto' } },
  });

  // Footer all pages
  const pgH   = doc.internal.pageSize.getHeight();
  const pgCt  = doc.getNumberOfPages();
  for (let p = 1; p <= pgCt; p++) {
    doc.setPage(p);
    doc.setFillColor(...DARK);
    doc.rect(0, pgH - 14, pageW, 14, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(`NauticShield Pre-Engagement Brief — CONFIDENTIAL — Page ${p} of ${pgCt}`, pageW / 2, pgH - 5, { align: 'center' });
  }

  doc.save(`NauticShield-Engagement-Brief-${new Date().toISOString().slice(0,10)}.pdf`);
}

function PenTestPanel({ tests, devices, scanResults, threats, fwRules, incidents }: {
  tests:       PenTest[];
  devices:     Device[];
  scanResults: ScanResult[];
  threats:     ThreatEntry[];
  fwRules:     FirewallRule[];
  incidents:   Incident[];
}) {
  const scheduledTest = tests.find(t => t.result === 'scheduled');
  const latestCompletedTest = [...tests]
    .filter(t => t.result !== 'scheduled')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const [lastCompletedDate, setLastCompletedDate] = useState(latestCompletedTest?.date ?? '');
  const [nextDueDate, setNextDueDate] = useState(scheduledTest?.date ?? latestCompletedTest?.nextDue ?? '');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PEN_TEST_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { lastCompletedDate?: string; nextDueDate?: string };
      if (parsed.lastCompletedDate) setLastCompletedDate(parsed.lastCompletedDate);
      if (parsed.nextDueDate) setNextDueDate(parsed.nextDueDate);
    } catch {
      // ignore invalid saved schedule state
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PEN_TEST_STORAGE_KEY, JSON.stringify({ lastCompletedDate, nextDueDate }));
    } catch {
      // ignore storage failures
    }
  }, [lastCompletedDate, nextDueDate]);

  const displayTests = tests.map(test => {
    if (test.result === 'scheduled') {
      return { ...test, date: nextDueDate || test.date, nextDue: nextDueDate || test.nextDue };
    }
    if (latestCompletedTest && test.id === latestCompletedTest.id) {
      return { ...test, date: lastCompletedDate || test.date, nextDue: nextDueDate || test.nextDue };
    }
    return test;
  });

  const daysUntil = nextDueDate
    ? Math.ceil((new Date(`${nextDueDate}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  type ScanPhase = 'idle' | 'scanning' | 'done';
  const [phase,         setPhase]         = useState<ScanPhase>('idle');
  const [progress,      setProgress]      = useState(0);
  const [label,         setLabel]         = useState('');
  const [result,        setResult]        = useState<{ score: number; checks: PenCheckResult[] } | null>(null);
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [pastScores,    setPastScores]    = useState<{ runAt: string; score: number }[]>([]);
  const [dbFindings,    setDbFindings]    = useState<CyberFinding[]>([]);
  const [remediatingId, setRemediatingId] = useState<string | null>(null);

  useEffect(() => {
    agentApi.cyber.listAssessments()
      .then(list => setPastScores(list.map(a => ({ runAt: a.runAt, score: a.score })).reverse()))
      .catch(() => {});
    agentApi.cyber.listFindings()
      .then(setDbFindings)
      .catch(() => {});
  }, []);

  async function markRemediated(id: string) {
    setRemediatingId(id);
    try {
      await agentApi.cyber.updateFinding(id, { findingStatus: 'remediated' });
      setDbFindings(prev => prev.map(f => f.id === id ? { ...f, findingStatus: 'remediated', remediatedAt: new Date().toISOString() } : f));
    } catch { /* ignore */ } finally {
      setRemediatingId(null);
    }
  }

  function runScan() {
    setPhase('scanning');
    setProgress(0);
    setResult(null);

    const steps = [
      'Enumerating network devices\u2026',
      'Scanning open ports\u2026',
      'Evaluating firewall rules\u2026',
      'Analysing active threats\u2026',
      'Checking incident backlog\u2026',
      'Running compliance checks\u2026',
      'Calculating score\u2026',
    ];
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        const final = scoreScanResults(devices, scanResults, threats, fwRules, incidents);
        setResult(final);
        setPhase('done');
        // Persist to DB (non-blocking)
        agentApi.cyber.saveAssessment(final.score, JSON.stringify(final.checks)).then(saved => {
          setPastScores(prev => [...prev, { runAt: saved.runAt, score: saved.score }]);
          agentApi.cyber.listFindings().then(setDbFindings).catch(() => {});
        }).catch(() => {});
        return;
      }
      setLabel(steps[i]);
      setProgress(Math.round(((i + 1) / steps.length) * 100));
      i++;
      setTimeout(tick, 480);
    };
    setTimeout(tick, 200);
  }

  const categories = result ? Array.from(new Set(result.checks.map(c => c.category))) : [];
  const statusIcon = (s: CheckStatus) => s === 'pass' ? '\u2713' : s === 'warn' ? '\u26a0' : '\u00d7';
  const statusColor = (s: CheckStatus) => s === 'pass' ? '#22c55e' : s === 'warn' ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(212,168,71,0.1)', border: '1px solid rgba(212,168,71,0.25)', borderRadius: 10, padding: 9 }}>
            <Fingerprint size={18} color={GOLD} />
          </div>
          <div>
            <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 700 }}>Security Scan</div>
            <div style={{ color: '#4a5a6a', fontSize: 12, marginTop: 2 }}>Single-click scan of your vessel network and security posture</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {nextDueDate && daysUntil !== null && (
            <span style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>
              Annual pen test in {Math.max(daysUntil, 0)}d
            </span>
          )}
          <button
            onClick={() => exportEngagementBrief(pastScores, dbFindings, tests)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(14,165,233,0.08)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <ClipboardList size={14} /> Engagement Brief
          </button>
          {result && (
            <button
              onClick={() => exportPenTestPDF(result.score, result.checks, scanResults)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(212,168,71,0.1)', color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <ClipboardList size={14} /> Export PDF
            </button>
          )}
          <button
            onClick={runScan}
            disabled={phase === 'scanning'}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: phase === 'scanning' ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.12)',
              color: phase === 'scanning' ? '#4a5a6a' : '#7dd3fc',
              border: `1px solid ${phase === 'scanning' ? '#1a2535' : 'rgba(14,165,233,0.35)'}`,
              borderRadius: 9, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: phase === 'scanning' ? 'default' : 'pointer',
            }}
          >
            <Radar size={15} /> {phase === 'idle' ? 'Run Security Scan' : phase === 'scanning' ? 'Scanning\u2026' : 'Rescan'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Last completed pen test</span>
          <input
            type="date"
            value={lastCompletedDate}
            onChange={event => {
              const value = event.target.value;
              setLastCompletedDate(value);
              if (value) setNextDueDate(addOneYear(value));
            }}
            style={{ background: '#080b10', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px', color: '#f0f4f8', fontSize: 13 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Next due date</span>
          <input
            type="date"
            value={nextDueDate}
            onChange={event => setNextDueDate(event.target.value)}
            style={{ background: '#080b10', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px', color: '#f0f4f8', fontSize: 13 }}
          />
        </label>
      </div>

      {/* Score trend sparkline */}
      {pastScores.length > 0 && (
        <div style={{ marginBottom: 18, background: '#080b10', borderRadius: 10, padding: '12px 16px', border: '1px solid #1a2535' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#4a5a6a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
              Assessment History — {pastScores.length} saved scan{pastScores.length !== 1 ? 's' : ''}
            </span>
            <span style={{ color: pastScores[pastScores.length - 1].score >= 80 ? '#22c55e' : pastScores[pastScores.length - 1].score >= 60 ? '#f59e0b' : '#ef4444', fontSize: 12, fontWeight: 700 }}>
              Latest: {pastScores[pastScores.length - 1].score}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
            {pastScores.map((s, i) => {
              const h = Math.max(4, Math.round((s.score / 100) * 38));
              const c = s.score >= 80 ? '#22c55e' : s.score >= 60 ? '#f59e0b' : '#ef4444';
              return (
                <div
                  key={i}
                  title={`${new Date(s.runAt).toLocaleDateString('en-GB')} — ${s.score}%`}
                  style={{ flex: 1, height: h, borderRadius: 3, background: c, opacity: i === pastScores.length - 1 ? 1 : 0.5, transition: 'height 0.4s' }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Scanning progress */}
      {phase === 'scanning' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#7dd3fc', fontSize: 12 }}>{label}</span>
            <span style={{ color: '#4a5a6a', fontSize: 12 }}>{progress}%</span>
          </div>
          <div style={{ background: '#080b10', borderRadius: 6, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)', borderRadius: 6, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < Math.round(progress / 100 * 7) ? '#0ea5e9' : '#1a2535', transition: 'background 0.4s' }} />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {phase === 'done' && result && (
        <div>
          {/* Score + summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, marginBottom: 20 }}>
            {/* Score ring */}
            <div style={{ background: '#080b10', border: `2px solid ${result.score >= 80 ? 'rgba(34,197,94,0.3)' : result.score >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: result.score >= 80 ? '#22c55e' : result.score >= 60 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>{result.score}%</div>
              <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 6, fontWeight: 600, letterSpacing: 0.8 }}>COMPLIANCE</div>
              <div style={{ marginTop: 10, background: result.score >= 80 ? 'rgba(34,197,94,0.1)' : result.score >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: result.score >= 80 ? '#22c55e' : result.score >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>
                {result.score >= 80 ? 'GOOD' : result.score >= 60 ? 'FAIR' : 'POOR'}
              </div>
            </div>
            {/* Check summary bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Passed',   count: result.checks.filter(c => c.status === 'pass').length, color: '#22c55e' },
                { label: 'Warnings', count: result.checks.filter(c => c.status === 'warn').length, color: '#f59e0b' },
                { label: 'Failed',   count: result.checks.filter(c => c.status === 'fail').length, color: '#ef4444' },
              ].map(({ label, count, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#6b7f92', fontSize: 12 }}>{label}</span>
                    <span style={{ color, fontWeight: 700, fontSize: 12 }}>{count}</span>
                  </div>
                  <div style={{ background: '#080b10', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / result.checks.length) * 100}%`, background: color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 6, color: '#4a5a6a', fontSize: 11 }}>
                Scanned {result.checks.length} controls across {categories.length} categories &middot; {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Check results by category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(cat => {
              const catChecks = result.checks.filter(c => c.category === cat);
              const isOpen    = expanded === cat;
              const catFail   = catChecks.filter(c => c.status === 'fail').length;
              const catWarn   = catChecks.filter(c => c.status === 'warn').length;
              const catPass   = catChecks.filter(c => c.status === 'pass').length;
              const catColor  = catFail > 0 ? '#ef4444' : catWarn > 0 ? '#f59e0b' : '#22c55e';
              return (
                <div key={cat} style={{ background: '#080b10', border: `1px solid ${catFail > 0 ? 'rgba(239,68,68,0.2)' : catWarn > 0 ? 'rgba(245,158,11,0.15)' : '#1a2535'}`, borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : cat)}
                    style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                    <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600, flex: 1 }}>{cat}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {catFail > 0  && <span style={{ background: 'rgba(239,68,68,0.1)',  color: '#ef4444', borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{catFail} fail</span>}
                      {catWarn > 0  && <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{catWarn} warn</span>}
                      {catPass > 0  && <span style={{ background: 'rgba(34,197,94,0.1)',  color: '#22c55e', borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{catPass} pass</span>}
                      <span style={{ color: '#4a5a6a' }}>{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #1a2535', padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {catChecks.map(c => (
                        <div key={c.check} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ color: statusColor(c.status), fontWeight: 700, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{statusIcon(c.status)}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 600 }}>{c.check}</div>
                            <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>{c.detail}</div>
                            <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                              <span style={{ background: 'rgba(212,168,71,0.08)', color: '#d4a847', border: '1px solid rgba(212,168,71,0.2)', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>{c.bimcoRef}</span>
                              <span style={{ background: 'rgba(14,165,233,0.08)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>{c.imoRef}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Idle state */}
      {phase === 'idle' && (
        <div style={{ background: '#080b10', borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, border: '1px dashed #1a2535' }}>
          <Radar size={32} color="#1a2535" />
          <div style={{ color: '#4a5a6a', fontSize: 13, textAlign: 'center' }}>
            Click <strong style={{ color: '#7dd3fc' }}>Run Security Scan</strong> to assess your vessel network &mdash; no technical knowledge required.<br />
            <span style={{ fontSize: 11 }}>The scan typically completes in under 5 seconds and checks {10} security controls.</span>
          </div>
        </div>
      )}

      {/* Open findings tracker */}
      {dbFindings.filter(f => f.findingStatus === 'open').length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #1a2535', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ color: '#4a5a6a', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const }}>
              Open Findings Tracker
            </div>
            <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>
              {dbFindings.filter(f => f.findingStatus === 'open').length} open
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dbFindings.filter(f => f.findingStatus === 'open').map(f => {
              const statColor = f.status === 'fail' ? '#ef4444' : '#f59e0b';
              return (
                <div key={f.id} style={{ background: '#080b10', border: `1px solid ${statColor}25`, borderLeft: `3px solid ${statColor}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                      <span style={{ background: `${statColor}15`, color: statColor, border: `1px solid ${statColor}40`, borderRadius: 4, padding: '1px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const }}>{f.status}</span>
                      <span style={{ background: 'rgba(212,168,71,0.08)', color: '#d4a847', border: '1px solid rgba(212,168,71,0.2)', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>{f.category}</span>
                      <span style={{ color: '#4a5a6a', fontSize: 10 }}>{new Date(f.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{f.check_name}</div>
                    <div style={{ color: '#6b7f92', fontSize: 11, lineHeight: 1.5 }}>{f.detail}</div>
                  </div>
                  <button
                    onClick={() => markRemediated(f.id)}
                    disabled={remediatingId === f.id}
                    style={{ flexShrink: 0, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: remediatingId === f.id ? 'default' : 'pointer', opacity: remediatingId === f.id ? 0.5 : 1 }}
                  >
                    {remediatingId === f.id ? 'Saving…' : '✓ Remediated'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pen test results ─ clickable accordion */}
      <div style={{ marginTop: 20, borderTop: '1px solid #1a2535', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ color: '#4a5a6a', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Professional Pen Test Results</div>
          <span style={{ color: '#4a5a6a', fontSize: 10 }}>Click any entry to view findings</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {displayTests.map(t => {
            const color      = t.result === 'pass' ? '#22c55e' : t.result === 'fail' ? '#ef4444' : GOLD;
            const Icon       = t.result === 'pass' ? CalendarCheck : t.result === 'fail' ? CalendarX : Clock;
            const isOpen     = expanded === t.id;
            const isScheduled= t.result === 'scheduled';
            const openFinds  = t.findings.filter(f => !f.remediated);
            const fixedFinds = t.findings.filter(f => f.remediated);
            return (
              <div key={t.id} style={{ background: '#080b10', borderRadius: 10, border: `1px solid ${isScheduled ? GOLD_BORDER : isOpen ? color + '40' : '#1a2535'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                {/* Row header */}
                <button
                  onClick={() => !isScheduled && setExpanded(isOpen ? null : t.id)}
                  style={{ width: '100%', background: 'transparent', border: 'none', cursor: isScheduled ? 'default' : 'pointer', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                >
                  <Icon size={14} color={color} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 1 }}>
                      {isScheduled
                        ? `Scheduled · ${new Date(t.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })} · ${t.firm || 'Firm TBD'}`
                        : `${t.firm} · ${new Date(t.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })} · Ref: ${t.reportRef}`}
                    </div>
                  </div>
                  {!isScheduled && (
                    <>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                        <div style={{ color, fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{t.score}%</div>
                        <div style={{ color: '#4a5a6a', fontSize: 10 }}>score</div>
                      </div>
                      <span style={{ background: `${color}18`, color, borderRadius: 5, padding: '2px 9px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {t.result.toUpperCase()}
                      </span>
                      <span style={{ color: '#4a5a6a', flexShrink: 0, marginLeft: 2 }}>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </>
                  )}
                  {isScheduled && (
                    <span style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 5, padding: '2px 9px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>UPCOMING</span>
                  )}
                </button>

                {/* Expanded findings */}
                {isOpen && !isScheduled && (
                  <div style={{ borderTop: '1px solid #1a2535', padding: '12px 14px 14px' }}>
                    {/* Summary bar */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      {[
                        { label: 'Critical', count: t.findings.filter(f => f.severity === 'critical').length, color: '#ef4444' },
                        { label: 'High',     count: t.findings.filter(f => f.severity === 'high').length,     color: '#f97316' },
                        { label: 'Medium',   count: t.findings.filter(f => f.severity === 'medium').length,   color: '#f59e0b' },
                        { label: 'Low',      count: t.findings.filter(f => f.severity === 'low').length,      color: '#22c55e' },
                        { label: 'Remediated', count: fixedFinds.length, color: '#0ea5e9' },
                        { label: 'Open',       count: openFinds.length,  color: '#ef4444' },
                      ].filter(s => s.count > 0).map(({ label, count, color: c }) => (
                        <div key={label} style={{ background: c + '15', border: `1px solid ${c}40`, borderRadius: 6, padding: '4px 10px' }}>
                          <span style={{ color: c, fontSize: 11, fontWeight: 700 }}>{count}</span>
                          <span style={{ color: '#4a5a6a', fontSize: 10, marginLeft: 4 }}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Findings list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {t.findings.map(f => {
                        const sevColor = f.severity === 'critical' ? '#ef4444' : f.severity === 'high' ? '#f97316' : f.severity === 'medium' ? '#f59e0b' : '#22c55e';
                        return (
                          <div key={f.id} style={{ background: '#0d1421', border: `1px solid ${f.remediated ? '#1a2535' : sevColor + '30'}`, borderRadius: 8, padding: '10px 13px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ flexShrink: 0, marginTop: 2 }}>
                              <span style={{ background: sevColor + '18', color: sevColor, borderRadius: 4, padding: '1px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const }}>{f.severity}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: f.remediated ? '#6b7f92' : '#f0f4f8', fontSize: 12, fontWeight: 600, marginBottom: 3, textDecoration: f.remediated ? 'line-through' : 'none' }}>{f.title}</div>
                              <div style={{ color: '#4a5a6a', fontSize: 11, lineHeight: 1.5 }}>{f.description}</div>
                              <div style={{ color: '#4a5a6a', fontSize: 10, marginTop: 4 }}>{f.category}</div>
                            </div>
                            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {f.remediated
                                ? <span style={{ color: '#22c55e', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={12} /> Fixed</span>
                                : <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>Open</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {openFinds.length === 0 && (
                      <div style={{ marginTop: 10, color: '#22c55e', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={12} /> All findings remediated
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Device protection coverage ────────────────────────────────────

function ProtectionCoverage({ coverage }: { coverage: DeviceProtection[] }) {
  const protected_  = coverage.filter(d => d.status === 'protected').length;
  const partial     = coverage.filter(d => d.status === 'partial').length;
  const unprotected = coverage.filter(d => d.status === 'unprotected').length;
  const pct = coverage.length ? Math.round((protected_ / coverage.length) * 100) : 0;

  const typeIcon = (type: string) => {
    if (type === 'laptop') return Laptop;
    if (type === 'phone') return Smartphone;
    return HardDrive;
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <CardLabel>Endpoint Protection Coverage</CardLabel>
        <span style={{ fontSize: 22, fontWeight: 800, color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</span>
      </div>

      {/* Coverage bar */}
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ flex: protected_, background: '#22c55e', transition: 'flex 0.4s' }} />
        <div style={{ flex: partial, background: '#f59e0b', transition: 'flex 0.4s' }} />
        <div style={{ flex: unprotected, background: '#ef4444', transition: 'flex 0.4s' }} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Protected',   count: protected_,  color: '#22c55e' },
          { label: 'Partial',     count: partial,     color: '#f59e0b' },
          { label: 'Unprotected', count: unprotected, color: '#ef4444' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ color: '#6b7f92', fontSize: 11 }}>{count} {label}</span>
          </div>
        ))}
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 90px', gap: 8, padding: '0 4px', marginBottom: 6 }}>
        {['Device', 'EDR', 'EPP', 'Encrypted', 'Status'].map(h => (
          <div key={h} style={{ color: '#3a4a5a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
        ))}
      </div>

      {/* Device rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
        {coverage.map(d => {
          const Icon = typeIcon(d.type);
          const sc = d.status === 'protected' ? { color: '#22c55e', label: 'Protected' } :
                     d.status === 'partial'    ? { color: '#f59e0b', label: 'Partial' } :
                                                 { color: '#ef4444', label: 'Exposed' };
          return (
            <div key={d.deviceId} style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 90px', gap: 8, alignItems: 'center',
              background: '#080b10', borderRadius: 8, padding: '8px 10px',
              border: `1px solid ${d.status === 'unprotected' ? 'rgba(239,68,68,0.15)' : '#1a2535'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Icon size={13} color="#4a5a6a" style={{ flexShrink: 0 }} />
                <span style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              </div>
              {[d.edr, d.epp, d.encrypted].map((ok, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                  {ok ? <BadgeCheck size={14} color="#22c55e" /> : <BadgeAlert size={14} color="#ef4444" />}
                </div>
              ))}
              <span style={{ background: `${sc.color}18`, color: sc.color, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>
                {sc.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}


// ── Device Risk Side Panel ────────────────────────────────────────

function DeviceRiskPanel({
  device,
  onClose,
  onIsolate,
  isolated,
}: {
  device:   Device;
  onClose:  () => void;
  onIsolate:(device: Device) => void;
  isolated: boolean;
}) {
  const cves = matchCVEs(device);
  const cli  = isolateCLI(device.ip);
  const [tab,         setTab]         = useState<'cves'|'cli'>('cves');
  const [cliPlatform, setCliPlatform] = useState<'iptables'|'pfsense'|'openwrt'>('iptables');
  const [copied,      setCopied]      = useState(false);

  const maxCvss    = cves.length > 0 ? cves[0].cvss : 0;
  const riskColor  = maxCvss >= 9 ? '#ef4444' : maxCvss >= 7 ? '#f97316' : maxCvss >= 4 ? '#f59e0b' : '#22c55e';
  const riskLabel  = maxCvss >= 9 ? 'CRITICAL' : maxCvss >= 7 ? 'HIGH' : maxCvss >= 4 ? 'MEDIUM' : cves.length === 0 ? 'CLEAR' : 'LOW';
  const sevColor   = (s: CveSeverity) => s === 'Critical' ? '#ef4444' : s === 'High' ? '#f97316' : s === 'Medium' ? '#f59e0b' : '#22c55e';

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 999,
      background: '#0d1421', borderLeft: `2px solid ${isolated ? '#ef4444' : riskColor}40`,
      display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a2535', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${riskColor}15`, border: `1px solid ${riskColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={16} color={riskColor} />
            </div>
            <div>
              <div style={{ color: '#f0f4f8', fontSize: 14, fontWeight: 700 }}>{device.name}</div>
              <div style={{ color: '#4a5a6a', fontSize: 11, fontFamily: 'monospace' }}>{device.ip} · {device.mac}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4a5a6a', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Risk badge row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}40`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 800 }}>
            {riskLabel} RISK
          </span>
          {maxCvss > 0 && (
            <span style={{ color: '#6b7f92', fontSize: 12 }}>Max CVSS: <strong style={{ color: riskColor }}>{maxCvss.toFixed(1)}</strong></span>
          )}
          <span style={{ background: '#080b10', border: '1px solid #1a2535', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#6b7f92' }}>
            {device.type} · {device.manufacturer || 'Unknown mfr'}
          </span>
          {isolated && (
            <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
              ⊘ ISOLATED
            </span>
          )}
        </div>
      </div>

      {/* Isolate button */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a2535', flexShrink: 0, background: isolated ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
        {isolated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WifiOff size={16} color="#ef4444" />
            <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>Device blocked in firewall — rule added below</span>
          </div>
        ) : (
          <button
            onClick={() => onIsolate(device)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Ban size={15} /> Isolate Device — Block All Traffic
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1a2535', flexShrink: 0 }}>
        {([['cves', `CVEs (${cves.length})`], ['cli', 'Router CLI Commands']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer',
            color: tab === t ? '#f0f4f8' : '#4a5a6a', fontSize: 12, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${GOLD}` : '2px solid transparent',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* CVE list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
        {tab === 'cves' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cves.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 40 }}>
                <ShieldCheck size={36} color="#22c55e" />
                <div style={{ color: '#22c55e', fontSize: 14, fontWeight: 700 }}>No known CVEs matched</div>
                <div style={{ color: '#4a5a6a', fontSize: 12, textAlign: 'center' }}>No vulnerabilities in the maritime CVE database match this device type and manufacturer. Continue monitoring.</div>
              </div>
            ) : cves.map(cve => {
              const sc = sevColor(cve.severity);
              return (
                <div key={cve.id} style={{ background: '#080b10', border: `1px solid ${sc}25`, borderLeft: `3px solid ${sc}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}40`, borderRadius: 4, padding: '1px 7px', fontSize: 9, fontWeight: 700 }}>{cve.severity.toUpperCase()}</span>
                        <span style={{ color: '#7dd3fc', fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }}>{cve.id}</span>
                        <span style={{ color: '#4a5a6a', fontSize: 10 }}>CVSS {cve.cvss.toFixed(1)}</span>
                        <span style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 4, padding: '1px 6px', fontSize: 9 }}>{cve.bimcoRef}</span>
                      </div>
                      <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{cve.title}</div>
                      <div style={{ color: '#6b7f92', fontSize: 11, lineHeight: 1.6, marginBottom: 8 }}>{cve.description}</div>
                      {cve.affectedFw && (
                        <div style={{ color: '#4a5a6a', fontSize: 10, marginBottom: 4 }}>Affected: <span style={{ color: '#8899aa' }}>{cve.affectedFw}</span></div>
                      )}
                      <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 7, padding: '7px 10px' }}>
                        <div style={{ color: '#22c55e', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>REMEDIATION</div>
                        <div style={{ color: '#8899aa', fontSize: 11, lineHeight: 1.5 }}>{cve.remediation}</div>
                      </div>
                    </div>
                    {/* CVSS gauge */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <svg width={44} height={44}>
                        <circle cx={22} cy={22} r={18} fill="none" stroke="#1a2535" strokeWidth={5} />
                        <circle
                          cx={22} cy={22} r={18}
                          fill="none" stroke={sc} strokeWidth={5}
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 18}
                          strokeDashoffset={2 * Math.PI * 18 * (1 - cve.cvss / 10)}
                          transform="rotate(-90 22 22)"
                          style={{ filter: `drop-shadow(0 0 3px ${sc})` }}
                        />
                        <text x={22} y={26} textAnchor="middle" fill={sc} fontSize={11} fontWeight={800}>{cve.cvss}</text>
                      </svg>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ background: cve.vector === 'Network' ? 'rgba(239,68,68,0.08)' : cve.vector === 'Adjacent' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', color: cve.vector === 'Network' ? '#ef4444' : cve.vector === 'Adjacent' ? '#f59e0b' : '#22c55e', border: '1px solid currentColor', borderRadius: 4, padding: '1px 7px', fontSize: 9, fontWeight: 600, opacity: 0.8 }}>
                      {cve.vector} vector
                    </span>
                    <span style={{ color: '#4a5a6a', fontSize: 10 }}>Published {cve.published}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'cli' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Info size={13} color="#f59e0b" />
                <span style={{ color: '#f59e0b', fontSize: 12 }}>Copy the command for your router/firewall platform and run it via SSH or the admin console.</span>
              </div>
            </div>

            {/* Platform selector */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['iptables', 'pfsense', 'openwrt'] as const).map(p => (
                <button key={p} onClick={() => setCliPlatform(p)} style={{
                  flex: 1, padding: '6px 0', background: cliPlatform === p ? 'rgba(14,165,233,0.15)' : '#080b10',
                  border: `1px solid ${cliPlatform === p ? 'rgba(14,165,233,0.4)' : '#1a2535'}`,
                  borderRadius: 8, color: cliPlatform === p ? '#7dd3fc' : '#6b7f92', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                  {p === 'iptables' ? 'Linux iptables' : p === 'pfsense' ? 'pfSense' : 'OpenWRT'}
                </button>
              ))}
            </div>

            {/* CLI output */}
            <div style={{ background: '#050810', border: '1px solid #1a2535', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #1a2535' }}>
                <span style={{ color: '#4a5a6a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Isolate {device.ip}</span>
                <button
                  onClick={() => copy(cli[cliPlatform])}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? 'rgba(34,197,94,0.1)' : GOLD_BG, color: copied ? '#22c55e' : GOLD, border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : GOLD_BORDER}`, borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: '14px 16px', color: '#7dd3fc', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {cli[cliPlatform]}
              </pre>
            </div>

            {/* Undo hint */}
            <div style={{ background: '#080b10', border: '1px solid #1a2535', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid #1a2535' }}>
                <span style={{ color: '#4a5a6a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Remove isolation</span>
              </div>
              <pre style={{ margin: 0, padding: '14px 16px', color: '#22c55e', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {cliPlatform === 'iptables' || cliPlatform === 'openwrt'
                  ? `iptables -D FORWARD -s ${device.ip} -j DROP\niptables -D FORWARD -d ${device.ip} -j DROP`
                  : `pfctl -t isolate -T delete ${device.ip}`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Risk Alert Toast ────────────────────────────────────────────

function RiskToast({
  device,
  cve,
  onView,
  onDismiss,
}: {
  device:    Device;
  cve:       MaritimeCVE;
  onView:    () => void;
  onDismiss: () => void;
}) {
  const sc = cve.severity === 'Critical' ? '#ef4444' : cve.severity === 'High' ? '#f97316' : '#f59e0b';

  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      background: '#0d1421',
      border: `1px solid ${sc}`,
      borderRadius: 12,
      padding: '14px 18px',
      minWidth: 320,
      maxWidth: 380,
      boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px ${sc}33`,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      animation: 'slideInRight 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={16} color={sc} />
          <span style={{ color: sc, fontWeight: 800, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {cve.severity} Risk Detected
          </span>
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5a6a', padding: 0, lineHeight: 1 }}
        >
          <X size={14} />
        </button>
      </div>

      <div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{device.name}</div>
        <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.4 }}>{cve.title}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: `${sc}22`, color: sc, border: `1px solid ${sc}44`,
            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800,
          }}>
            CVSS {cve.cvss.toFixed(1)}
          </span>
          <span style={{ color: '#4a5a6a', fontSize: 10 }}>{cve.bimcoRef}</span>
        </div>
        <button
          onClick={onView}
          style={{
            background: sc, border: 'none', borderRadius: 7,
            padding: '5px 14px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          View Risk →
        </button>
      </div>
    </div>
  );
}

// ── Live Threat Pulse strip ───────────────────────────────────────

function LiveThreatPulse({
  devices,
  onDeviceClick,
  isolatedIps,
}: {
  devices:       Device[];
  onDeviceClick: (d: Device) => void;
  isolatedIps:   Set<string>;
}) {
  const [, setTick]   = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setTick(t => t + 1);
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const assessed = devices.map(d => {
    const cves = matchCVEs(d);
    const maxCvss = cves.length > 0 ? cves[0].cvss : 0;
    return { device: d, cves, maxCvss, isolated: isolatedIps.has(d.ip) };
  });

  const critical = assessed.filter(a => a.maxCvss >= 9 && !a.isolated);
  const high     = assessed.filter(a => a.maxCvss >= 7 && a.maxCvss < 9 && !a.isolated);
  const _clear   = assessed.filter(a => a.maxCvss < 4 || a.cves.length === 0); void _clear;

  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: critical.length > 0 ? '#ef4444' : high.length > 0 ? '#f59e0b' : '#22c55e',
            boxShadow: `0 0 8px ${critical.length > 0 ? '#ef4444' : high.length > 0 ? '#f59e0b' : '#22c55e'}`,
            animation: pulse ? 'none' : undefined,
            opacity: pulse ? 0.4 : 1,
            transition: 'opacity 0.3s',
          }} />
          <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 700 }}>Live CVE Threat Monitor</span>
          <span style={{ color: '#4a5a6a', fontSize: 11 }}>· refreshes every 30s · {assessed.length} devices</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {critical.length > 0 && <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{critical.length} critical</span>}
          {high.length > 0     && <span style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{high.length} high</span>}
          {isolatedIps.size > 0 && <span style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>⊘ {isolatedIps.size} isolated</span>}
          <RefreshCw size={13} color={pulse ? '#0ea5e9' : '#4a5a6a'} style={{ transition: 'color 0.3s', marginTop: 2 }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {assessed
          .sort((a, b) => b.maxCvss - a.maxCvss)
          .map(({ device: d, cves, maxCvss, isolated }) => {
          const riskColor = isolated ? '#6b7f92' : maxCvss >= 9 ? '#ef4444' : maxCvss >= 7 ? '#f97316' : maxCvss >= 4 ? '#f59e0b' : '#22c55e';
          const riskLabel = isolated ? 'ISOLATED' : maxCvss >= 9 ? 'CRITICAL' : maxCvss >= 7 ? 'HIGH' : maxCvss >= 4 ? 'MEDIUM' : 'CLEAR';
          const barW      = isolated ? 0 : Math.round((maxCvss / 10) * 100);
          return (
            <button
              key={d.id}
              onClick={() => onDeviceClick(d)}
              style={{
                width: '100%', background: isolated ? 'rgba(239,68,68,0.03)' : '#080b10',
                border: `1px solid ${isolated ? 'rgba(239,68,68,0.2)' : maxCvss >= 7 ? riskColor + '30' : '#1a2535'}`,
                borderRadius: 9, padding: '9px 13px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12, opacity: d.status === 'offline' ? 0.5 : 1,
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${riskColor}15` }}>
                {isolated ? <Ban size={13} color="#ef4444" /> : maxCvss >= 7 ? <ShieldAlert size={13} color={riskColor} /> : <ShieldCheck size={13} color={riskColor} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 600 }}>{d.name}</span>
                  <span style={{ color: '#4a5a6a', fontSize: 10, fontFamily: 'monospace' }}>{d.ip}</span>
                  {d.status === 'online' && !isolated && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 4px #22c55e' }} />
                  )}
                </div>
                {/* CVSS bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 3, background: '#1a2535', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barW}%`, background: riskColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ color: riskColor, fontSize: 10, fontWeight: 700, flexShrink: 0, minWidth: 50 }}>
                    {isolated ? '⊘ Blocked' : cves.length > 0 ? `${cves.length} CVE${cves.length > 1 ? 's' : ''} · ${maxCvss.toFixed(1)}` : 'No CVEs'}
                  </span>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ background: `${riskColor}18`, color: riskColor, borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 700 }}>{riskLabel}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function Cyber() {
  const { devices } = useVesselData();
  const [threats,      setThreats]      = useState<ThreatEntry[]>(mockThreats);
  const [fwRules,      setFwRules]      = useState<FirewallRule[]>(defaultFirewallRules);
  const [incidents,    setIncidents]    = useState<Incident[]>(mockIncidents);
  const [scanOpen,     setScanOpen]     = useState(false);
  const [selectedDev,  setSelectedDev]  = useState<Device | null>(null);
  const [isolatedIps,  setIsolatedIps]  = useState<Set<string>>(new Set());
  const [riskAlerts,   setRiskAlerts]   = useState<{id: string; device: Device; cve: MaritimeCVE}[]>([]);

  // Fire risk alerts on mount for all Critical/High CVSS devices
  useEffect(() => {
    const alerts = devices
      .filter(d => !isolatedIps.has(d.ip))
      .map(d => { const cves = matchCVEs(d); return { device: d, cve: cves[0] }; })
      .filter(x => x.cve && x.cve.cvss >= 7.0)
      .slice(0, 4)
      .map(x => ({ id: `${x.device.id}-${x.cve!.id}`, device: x.device, cve: x.cve! }));
    if (alerts.length > 0) setRiskAlerts(alerts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissAlert = (id: string) => setRiskAlerts(prev => prev.filter(a => a.id !== id));

  const scanResults   = buildScanResults(devices);
  const coverage      = buildProtection(devices);
  const activeThreats = threats.filter(t => !t.mitigated);
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const overallDanger = Math.min(100, activeThreats.length * 18 + scanResults.filter(r => r.flagged).length * 6);
  const protectedPct  = coverage.length ? Math.round((coverage.filter(d => d.status === 'protected').length / coverage.length) * 100) : 0;

  function mitigate(id: string) {
    setThreats(ts => ts.map(t => t.id === id ? { ...t, mitigated: true } : t));
  }
  function toggleRule(id: string) {
    setFwRules(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }
  function updateIncident(id: string, status: IncidentStatus) {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status, updated: new Date().toISOString() } : i));
  }

  function isolateDevice(device: Device) {
    setIsolatedIps(prev => new Set([...prev, device.ip]));
    // Add in-app firewall block rule
    const ruleId = `iso-${device.id}`;
    setFwRules(prev => {
      if (prev.some(r => r.id === ruleId)) return prev;
      return [...prev, {
        id: ruleId,
        name: `Isolate ${device.name}`,
        direction: 'inbound' as const,
        action: 'block' as const,
        port: 'All',
        protocol: 'Any',
        enabled: true,
      }];
    });
  }

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Cyber Management</div>
            <PremiumBadge />
          </div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            Real-time threat detection, port scanning and firewall control
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setScanOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Radar size={15} /> {scanOpen ? 'Hide Port Scan' : 'Run Port Scan'}
          </button>
        </div>
      </div>

      <CyberSectionNav />

      {/* KPI strip */}
      <div id="cyber-overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, scrollMarginTop: 88 }}>
        {[
          { label: 'Active Threats',    value: activeThreats.length,                                   icon: ShieldAlert,   color: activeThreats.length > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Open Incidents',    value: activeIncidents.length,                                 icon: ClipboardList, color: activeIncidents.length > 0 ? '#f97316' : '#22c55e' },
          { label: 'Endpoint Coverage', value: `${protectedPct}%`,                                     icon: ShieldCheck,   color: protectedPct >= 80 ? '#22c55e' : protectedPct >= 50 ? '#f59e0b' : '#ef4444' },
          { label: 'Firewall Rules',    value: `${fwRules.filter(r => r.enabled).length}/${fwRules.length}`, icon: Lock,     color: GOLD },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', color: '#4a5a6a' }}>{label}</div>
              <Icon size={14} color={color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Live CVE Monitor */}
      <LiveThreatPulse
        devices={devices}
        onDeviceClick={setSelectedDev}
        isolatedIps={isolatedIps}
      />

      {/* Threat score + feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>

        {/* Score */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CardLabel>Vessel Threat Score</CardLabel>
          <ThreatRing score={100 - overallDanger} />
          <div style={{ borderTop: '1px solid #1a2535', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Encryption',       ok: true  },
              { label: 'Firewall active',  ok: fwRules.some(r => r.enabled && r.action === 'block') },
              { label: 'No rogue devices', ok: !threats.some(t => t.type === 'Rogue Device' && !t.mitigated) },
              { label: 'CVE free',         ok: !threats.some(t => t.type.includes('CVE') && !t.mitigated) },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ok ? <CheckCircle2 size={13} color="#22c55e" /> : <AlertTriangle size={13} color="#f59e0b" />}
                <span style={{ color: ok ? '#8899aa' : '#f0f4f8', fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Threat feed */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <CardLabel>Threat Intelligence Feed</CardLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                {threats.filter(t => (t.level === 'critical' || t.level === 'high') && !t.mitigated).length} high priority
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {threats.map(t => <ThreatRow key={t.id} threat={t} onMitigate={mitigate} />)}
          </div>
        </Card>
      </div>

      {/* Port scan (toggleable) */}
      <div id="cyber-scanning" style={{ display: 'flex', flexDirection: 'column', gap: 14, scrollMarginTop: 88 }}>
        {scanOpen && <PortScanTable results={scanResults} />}

        {/* Traffic + Firewall side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <TrafficMonitor />
          <FirewallPanel rules={fwRules} onToggle={toggleRule} />
        </div>
      </div>

      {/* Incident log */}
      <div id="cyber-incidents" style={{ scrollMarginTop: 88 }}>
        <IncidentLog incidents={incidents} onUpdateStatus={updateIncident} />
      </div>

      {/* Pen test — full width */}
      <div id="cyber-pen-tests" style={{ scrollMarginTop: 88 }}>
        <PenTestPanel
          tests={mockPenTests}
          devices={devices}
          scanResults={scanResults}
          threats={threats}
          fwRules={fwRules}
          incidents={incidents}
        />
      </div>

      {/* Protection coverage — full width */}
      <div id="cyber-coverage" style={{ scrollMarginTop: 88 }}>
        <ProtectionCoverage coverage={coverage} />
      </div>

      {/* Recommendations */}
      <div id="cyber-recommendations" style={{ scrollMarginTop: 88 }}>
        <Card style={{ border: `1px solid ${GOLD_BORDER}`, background: `linear-gradient(135deg, #0d1421 80%, rgba(212,168,71,0.04))` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Fingerprint size={16} color={GOLD} />
            <CardLabel>AI Security Recommendations</CardLabel>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: ShieldX,    color: '#ef4444', text: 'Isolate device 192.168.0.138 — unrecognised MAC with active probe requests. Block at switch level.' },
              { icon: Globe,      color: '#f97316', text: 'Enable outbound traffic filtering. Samsung TV is beaconing to analytics servers on non-standard ports.' },
              { icon: TrendingUp, color: '#f59e0b', text: 'Update Hikvision camera firmware immediately — CVE-2023-1 allows unauthenticated remote code execution.' },
              { icon: Zap,        color: GOLD,      text: 'Consider enabling Starlink Enhanced Security Mode to block inbound unsolicited traffic before it reaches the LAN.' },
            ].map(({ icon: Icon, color, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#080b10', borderRadius: 10, padding: '12px 14px', border: '1px solid #1a2535' }}>
                <Icon size={14} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ color: '#8899aa', fontSize: 13, lineHeight: 1.6 }}>{text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Device risk side panel */}
      {selectedDev && (
        <DeviceRiskPanel
          device={selectedDev}
          onClose={() => setSelectedDev(null)}
          onIsolate={isolateDevice}
          isolated={isolatedIps.has(selectedDev.ip)}
        />
      )}

      {/* Risk alert toasts — bottom-right stack */}
      {riskAlerts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          display: 'flex', flexDirection: 'column', gap: 10,
          zIndex: 9999, pointerEvents: 'none',
        }}>
          <style>{`@keyframes slideInRight { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }`}</style>
          {riskAlerts.map(a => (
            <div key={a.id} style={{ pointerEvents: 'all' }}>
              <RiskToast
                device={a.device}
                cve={a.cve}
                onView={() => { setSelectedDev(a.device); dismissAlert(a.id); }}
                onDismiss={() => dismissAlert(a.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
