export interface CyberFindingLike {
  category: string;
  check_name: string;
  detail: string;
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

export function recommendedActionsForFinding(finding: CyberFindingLike): string[] {
  const text = `${finding.category} ${finding.check_name} ${finding.detail}`.toLowerCase();

  if (hasAny(text, ['default credential', 'default password', 'factory password'])) {
    return [
      'Rotate the device admin password immediately and store it in the vessel password vault.',
      'Disable default/admin accounts where the platform allows it.',
      'Restrict management access to captain/owner VLAN only.',
    ];
  }

  if (hasAny(text, ['telnet', 'plaintext', 'unencrypted', 'http '])) {
    return [
      'Disable plaintext management protocols and enforce SSH/HTTPS only.',
      'Rotate any credentials that may have been exposed over plaintext channels.',
      'Confirm certificates/keys are in place for encrypted management traffic.',
    ];
  }

  if (hasAny(text, ['mfa', 'multi-factor', 'multi factor'])) {
    return [
      'Enforce MFA for all remote access accounts (owner, captain, contractors).',
      'Block legacy authentication methods that bypass MFA.',
      'Review and remove dormant remote access accounts.',
    ];
  }

  if (hasAny(text, ['vlan', 'segmentation', 'flat network', 'guest'])) {
    return [
      'Apply ACL rules to block guest and crew VLAN access to bridge/navigation assets.',
      'Verify segmentation with a host-to-host connectivity test from each VLAN.',
      'Document the approved inter-VLAN exceptions for operations.',
    ];
  }

  if (hasAny(text, ['firmware', 'cve', 'eol', 'patch', 'unpatched'])) {
    return [
      'Update affected firmware/software to a vendor-supported version.',
      'If patching is delayed, isolate the asset with stricter firewall rules.',
      'Create a dated remediation ticket with owner/captain sign-off.',
    ];
  }

  if (hasAny(text, ['logging', 'siem', 'monitoring', 'ids', 'ips'])) {
    return [
      'Enable central log forwarding for router, firewall, and critical endpoints.',
      'Create alerts for repeated auth failures and unusual outbound traffic.',
      'Validate log retention is at least 30 days for incident review.',
    ];
  }

  if (hasAny(text, ['rdp', 'remote desktop'])) {
    return [
      'Disable direct RDP exposure and require VPN jump-host access.',
      'Restrict remote desktop by source IP and vessel role.',
      'Review successful and failed RDP login logs for anomalies.',
    ];
  }

  if (hasAny(text, ['firewall', 'port', 'exposed', 'open service'])) {
    return [
      'Close unnecessary inbound ports and document remaining required services.',
      'Restrict management services to approved admin source ranges only.',
      'Re-run the exposure scan after rule updates to verify closure.',
    ];
  }

  return [
    'Verify scope and impact of the finding with captain/owner.',
    'Apply the smallest safe containment action now, then schedule permanent remediation.',
    'Record remediation notes and evidence in NauticShield once completed.',
  ];
}

export function formatPlaybookForAlert(actions: string[], max = 3): string {
  return actions.slice(0, max).map((step, index) => `${index + 1}. ${step}`).join(' ');
}
