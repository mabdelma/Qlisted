import React, { useCallback, useEffect, useState } from 'react';
import { Text, View, StyleSheet, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MenuScreen from './src/screens/MenuScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import AccountScreen from './src/screens/AccountScreen';
import QRScanScreen from './src/screens/QRScanScreen';
import { handleDeepLink } from './src/services/deepLink';
import { useOfflineSync, setNetInfoConnected } from './src/hooks/useOfflineSync';
import { registerForPushNotificationsAsync, addNotificationResponseListener } from './src/services/pushNotifications';

const BASE_URL = process.env.APP_BASE_URL || 'https://qlisted.com';

type TabParamList = {
  Menu: { slug?: string; tableId?: string };
  Orders: { slug?: string };
  Account: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<string, string> = {
  Menu: '🍽️',
  Orders: '📋',
  Scan: '📷',
  Account: '👤',
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, color: focused ? '#2563eb' : '#6b7280' }}>
        {TAB_ICONS[label] || '•'}
      </Text>
    </View>
  );
}

function AppInner() {
  const { isOnline, pendingCount } = useOfflineSync();
  const [slug, setSlug] = useState('demo-cafe');
  const [tableId, setTableId] = useState<string | undefined>();
  const [showScanner, setShowScanner] = useState(false);

  const handleUrl = useCallback((url: string) => {
    const resolved = handleDeepLink(url);
    if (resolved) {
      setSlug(resolved.slug);
      setTableId(resolved.tableId);
    }
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    return () => sub.remove();
  }, [handleUrl]);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        fetch(`${BASE_URL}/api/r/${slug}/push/expo/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }).catch(() => {});
      }
    });
  }, [slug]);

  useEffect(() => {
    const unsub = addNotificationResponseListener((response) => {
      const data = response.notification?.request?.content?.data;
      if (data?.slug) {
        setSlug(data.slug as string);
        setTableId(data.tableId as string | undefined);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      const netInfo = { isConnected: true };
      setNetInfoConnected(netInfo.isConnected);
    }, 1000);
    return () => clearTimeout(handle);
  }, []);

  function handleScan(slug: string, tableId?: string) {
    setSlug(slug);
    setTableId(tableId);
    setShowScanner(false);
  }

  const linking: LinkingOptions<TabParamList> = {
    prefixes: ['qcart://', BASE_URL],
    config: {
      screens: {
        Menu: {
          path: 'r/:slug/table/:tableId',
          parse: { slug: (s: string) => s, tableId: (t: string) => t },
        },
        Orders: 'orders',
      },
    },
  };

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            No internet connection{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
          </Text>
        </View>
      )}
      <NavigationContainer linking={linking}>
        <StatusBar style="dark" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#6b7280',
          }}
        >
          <Tab.Screen
            name="Menu"
            children={() => <MenuScreen slug={slug} tableId={tableId} baseUrl={BASE_URL} />}
            initialParams={{ slug, tableId }}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon label="Menu" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Orders"
            children={() => <OrdersScreen slug={slug} baseUrl={BASE_URL} />}
            initialParams={{ slug }}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon label="Orders" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Scan"
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
                setShowScanner(true);
              },
            }}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon label="Scan" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Account"
            children={() => <AccountScreen slug={slug} baseUrl={BASE_URL} isOnline={isOnline} />}
            options={{
              tabBarIcon: ({ focused }) => <TabIcon label="Account" focused={focused} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>

      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <QRScanScreen onScan={handleScan} onClose={() => setShowScanner(false)} />
      </Modal>
    </View>
  );
}

export default function App() {
  return <AppInner />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  offlineBanner: {
    backgroundColor: '#fef3cd',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    color: '#856404',
    fontSize: 12,
    fontWeight: '600',
  },
});
