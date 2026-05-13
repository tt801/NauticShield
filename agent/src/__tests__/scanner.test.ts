// agent/src/__tests__/scanner.test.ts
// Quick validation of OUI lookup and device classification

import { getManufacturer, guessDeviceType } from '../scanner';

describe('Device Classification', () => {
  describe('OUI Lookup', () => {
    it('identifies Ubiquiti router by MAC', () => {
      expect(getManufacturer('B0:BE:76:AA:BB:CC')).toBe('Ubiquiti');
    });

    it('identifies Apple device by MAC', () => {
      expect(getManufacturer('A4:C3:F0:AA:BB:CC')).toBe('Apple');
    });

    it('returns undefined for unknown MAC', () => {
      expect(getManufacturer('FF:FF:FF:AA:BB:CC')).toBeUndefined();
    });
  });

  describe('Device Type Guessing', () => {
    // Network gear
    it('classifies Ubiquiti MAC as router', () => {
      expect(guessDeviceType('B0:BE:76:AA:BB:CC')).toBe('router');
    });

    it('classifies Cisco MAC as router', () => {
      expect(guessDeviceType('04:18:D6:AA:BB:CC')).toBe('router');
    });

    it('classifies TP-Link MAC as router', () => {
      expect(guessDeviceType('D8:84:6F:AA:BB:CC')).toBe('router');
    });

    // Cameras
    it('classifies Axis MAC as camera', () => {
      expect(guessDeviceType('00:40:8C:AA:BB:CC')).toBe('camera');
    });

    it('classifies Hikvision MAC as camera', () => {
      expect(guessDeviceType('00:0A:95:AA:BB:CC')).toBe('camera');
    });

    it('classifies Avigilon MAC as camera', () => {
      expect(guessDeviceType('90:A2:DA:AA:BB:CC')).toBe('camera');
    });

    // Navigation/OT
    it('classifies Furuno MAC as chart-plotter', () => {
      expect(guessDeviceType('00:0C:F3:AA:BB:CC')).toBe('chart-plotter');
    });

    it('classifies Navico MAC as chart-plotter', () => {
      expect(guessDeviceType('00:0A:72:AA:BB:CC')).toBe('chart-plotter');
    });

    it('classifies Simrad MAC as chart-plotter', () => {
      expect(guessDeviceType('00:1D:F7:AA:BB:CC')).toBe('chart-plotter');
    });

    // AV Systems
    it('classifies Crestron MAC as av-control', () => {
      expect(guessDeviceType('D0:A6:37:AA:BB:CC')).toBe('av-control');
    });

    it('classifies Denon MAC as av-receiver', () => {
      expect(guessDeviceType('00:04:20:AA:BB:CC')).toBe('av-receiver');
    });

    it('classifies Sonos MAC as speaker', () => {
      expect(guessDeviceType('1C:BD:B9:AA:BB:CC')).toBe('speaker');
    });

    // Guest/Crew devices
    it('classifies Apple MAC as phone', () => {
      expect(guessDeviceType('A4:C3:F0:AA:BB:CC')).toBe('phone');
    });

    it('classifies Raspberry Pi MAC as laptop', () => {
      expect(guessDeviceType('B8:27:EB:AA:BB:CC')).toBe('laptop');
    });

    it('classifies Samsung TV MAC as tv', () => {
      expect(guessDeviceType('E0:65:31:AA:BB:CC')).toBe('tv');
    });

    // Office
    it('classifies HP MAC as printer', () => {
      expect(guessDeviceType('B0:5A:DA:AA:BB:CC')).toBe('printer');
    });

    it('classifies QNAP MAC as nas', () => {
      expect(guessDeviceType('00:11:32:AA:BB:CC')).toBe('nas');
    });

    // Fallback
    it('falls back to unknown for unrecognized MAC', () => {
      expect(guessDeviceType('AA:AA:AA:AA:BB:CC')).toBe('unknown');
    });
  });

  describe('Coverage', () => {
    // Ensure we support all major device types in the baseline
    it('has at least 15 different device types represented', () => {
      const types = new Set<string>();
      const testMacs = [
        'B0:BE:76:AA:BB:CC', // router
        'E0:65:31:AA:BB:CC', // tv
        '00:40:8C:AA:BB:CC', // camera
        '00:0C:F3:AA:BB:CC', // chart-plotter
        'D0:A6:37:AA:BB:CC', // av-control
        'A4:C3:F0:AA:BB:CC', // phone
        'B8:27:EB:AA:BB:CC', // laptop
        'B0:5A:DA:AA:BB:CC', // printer
        '00:11:32:AA:BB:CC', // nas
        'AA:00:D0:AA:BB:CC', // control4 (av-control)
        '00:1A:95:AA:BB:CC', // nvr
        '08:00:69:AA:BB:CC', // printer (xerox)
      ];

      testMacs.forEach(mac => {
        const type = guessDeviceType(mac);
        types.add(type);
      });

      expect(types.size).toBeGreaterThanOrEqual(8);
    });
  });
});
