import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { registerForPushNotificationsAsync } from '../services/pushNotifications';

interface AccountScreenProps {
  slug: string;
  baseUrl: string;
  isOnline: boolean;
}

const AccountScreen: React.FC<AccountScreenProps> = ({ slug, baseUrl, isOnline }) => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setPushEnabled(true);
      }
    });
  }, []);

  async function handleTogglePush() {
    if (pushEnabled) {
      setPushEnabled(false);
      return;
    }

    setPushLoading(true);
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setPushToken(token);
        setPushEnabled(true);
        await fetch(`${baseUrl}/api/r/${slug}/push/expo/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      }
    } catch {
      // registration failed
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Restaurant</Text>
        <Text style={styles.value}>{slug}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Connection</Text>
        <View style={styles.row}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
          <Text style={styles.value}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.row} onPress={handleTogglePush} disabled={pushLoading}>
        <Text style={styles.rowText}>Push Notifications</Text>
        <View style={styles.rowRight}>
          {pushLoading ? (
            <Text style={styles.loadingText}>...</Text>
          ) : (
            <View style={[styles.toggle, pushEnabled && styles.toggleActive]}>
              <View style={[styles.toggleDot, pushEnabled && styles.toggleDotActive]} />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row}>
        <Text style={styles.rowText}>About QCart</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton}>
        <Text style={styles.signOutText}>Switch Restaurant</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingTop: 60 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: { fontSize: 18, fontWeight: '600', color: '#111827' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  rowText: { fontSize: 16, color: '#374151' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  chevron: { fontSize: 22, color: '#9ca3af', marginLeft: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: '#2563eb' },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleDotActive: { alignSelf: 'flex-end' },
  loadingText: { color: '#9ca3af', fontSize: 14 },
  signOutButton: {
    marginTop: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});

export default AccountScreen;
