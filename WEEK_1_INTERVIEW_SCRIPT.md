# NauticShield Week 1 Chief Engineer Interview Script

Use this script to interview the chief engineer or IT lead on each boat. Target 30-45 minutes. Record notes in the boat worksheet at the end of WEEK_1_PILOT_CHECKLIST.md.

**Tone**: We are here to solve their actual problems, not sell them a feature list. Listen more than you talk.

---

## Opening (2 min)

"Thanks for your time. We are building NauticShield to help superyachts see and control what's on their network, and respond faster when things break. To build something useful for your boat, we need to understand your actual pain points — not the official IT checklist, but what actually causes headaches for you and the crew."

---

## Internet & Failover (5 min)

**Goal**: Understand connectivity pain, WAN failover behavior, and who bears the cost when it breaks.

1. "When the primary internet link drops, what actually happens? How does it fail over, and who fixes it?"
2. "How often does that happen? What's the impact when it does?"
3. "If you had to rate your internet reliability as a score out of 10, what would it be?"
4. "Who gets blamed first when guests complain about Wi-Fi? The captain? The crew? You?"

---

## Network Visibility (5 min)

**Goal**: Understand how undocumented the network is, and whether they track what is on it.

1. "Do you have a current inventory of devices on your network? (Honest answer is usually 'no' or 'sort of')"
2. "How often do you find devices on the network that nobody remembers installing?"
3. "If an unknown device appeared on Wi-Fi today, would you notice? How would you handle it?"
4. "Do you know which systems are isolated on VLANs and which ones are not?"

---

## High-Value Systems (5 min)

**Goal**: Identify which outages hurt the owner most (revenue, safety, experience).

1. "Which systems are most critical for the owner's experience when underway? (Navigation? Guest Wi-Fi? AV?)"
2. "Which systems break the most? What usually happens when they do?"
3. "Are there any systems that if they fail, you lose money or have a safety issue?"
4. "Which vendor or systems cause you the most support headaches?"

---

## Remote Support & Monitoring (5 min)

**Goal**: Understand the current support model and whether there is a gap NauticShield can fill.

1. "How do you typically get alerted when something breaks? (Manual report, WhatsApp, you notice it?)"
2. "Who provides remote support when you need it? (Vendors? In-house? Mixed?)"
3. "How many different remote access tools do you use today? (TeamViewer, AnyDesk, SSH, vendor portals?)"
4. "What's the biggest pain in troubleshooting something today? Lack of visibility? Too many tools? No audit trail?"

---

## Security Posture (3 min)

**Goal**: Understand whether security is a current priority and what they already monitor.

1. "Do you have any cybersecurity tools running today? (Firewall, IDS, AV, asset inventory?)"
2. "How often do you check for firmware updates on network devices? (Routers, APs, firewalls?)"
3. "If someone asked you to prove the network is secure, what would you show them?"
4. "Have you ever had a security incident? What happened?"

---

## OT / Navigation Systems (3 min)

**Goal**: Understand whether OT is a concern and how isolated it really is.

1. "Are your navigation systems isolated from the guest network?"
2. "How old are your ECDIS, radar, and engine monitoring systems?"
3. "Who has access to those systems? (Only the master? Bridge crew? Remote vendors?)"
4. "Do those systems ever connect to the internet?"

---

## Close (2 min)

"If you could solve one problem related to network visibility or security on your boat, what would it be?"

---

## Notes Section

After the interview, fill in the boat worksheet with:

- **Biggest pain**: [What keeps them up at night?]
- **Most critical system**: [What cannot fail?]
- **Current monitoring**: [What do they already see?]
- **Biggest blindspot**: [What don't they see?]
- **Quick win**: [What could we show them in week 1 that would be immediately useful?]
- **Trust builder**: [What would make them confident NauticShield is not another "tool they have to manage"?]

---

## Follow-Up

"We are going to focus the first version of NauticShield on [quick win]. That should give you visibility into [blindspot] and help with [biggest pain]. We'll have something testable in about 8 weeks. Does that sound useful?"

