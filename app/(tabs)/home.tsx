import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import UserStats from '../../components/UserStats';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';

export default function HomePage() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    // First get all chats where the user is a participant
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants.requesterId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (chatSnapshot) => {
      let totalUnread = 0;

      // For each chat, get messages that haven't been read by the user
      for (const chatDoc of chatSnapshot.docs) {
        const messagesQuery = query(
          collection(db, 'chats', chatDoc.id, 'messages'),
          where('senderId', '!=', auth.currentUser.uid)  // Messages not sent by current user
        );

        const messageSnapshot = await getDocs(messagesQuery);
        const unreadCount = messageSnapshot.docs.filter(
          doc => !doc.data().readBy?.includes(auth.currentUser?.uid)
        ).length;

        totalUnread += unreadCount;
      }

      setUnreadCount(totalUnread);
    });

    // Also check chats where user is helper
    const helperChatsQuery = query(
      collection(db, 'chats'),
      where('participants.helperId', '==', auth.currentUser.uid)
    );

    const helperUnsubscribe = onSnapshot(helperChatsQuery, async (chatSnapshot) => {
      let totalUnread = 0;

      for (const chatDoc of chatSnapshot.docs) {
        const messagesQuery = query(
          collection(db, 'chats', chatDoc.id, 'messages'),
          where('senderId', '!=', auth.currentUser.uid)  // Messages not sent by current user
        );

        const messageSnapshot = await getDocs(messagesQuery);
        const unreadCount = messageSnapshot.docs.filter(
          doc => !doc.data().readBy?.includes(auth.currentUser?.uid)
        ).length;

        totalUnread += unreadCount;
      }

      setUnreadCount(prev => prev + totalUnread);
    });

    return () => {
      unsubscribe();
      helperUnsubscribe();
    };
  }, []);

  const navigateToGetHelp = () => {
    router.push('/post-request');
  };

  const navigateToHelpOthers = () => {
    router.push('/help-requests' as any);
  };

  const navigateToMyChats = () => {
    router.push('/chats' as any);
  };

  const navigateToProfile = () => {
    router.push('/(tabs)/profile' as any);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/auth/login' as any);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Helping Hands</Text>
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
          <Text style={styles.welcomeText}>Welcome back! 👋</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.userInfo}>
              <UserStats showUserInfo={true} />
            </View>
            <TouchableOpacity 
              style={styles.viewProfileButton}
              onPress={navigateToProfile}
            >
              <Ionicons name="chevron-forward" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.statsContainer}>
            <UserStats showTrophiesOnly={true} />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={[styles.actionButton, styles.getHelpButton]}
              onPress={navigateToGetHelp}
            >
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]}>
                <Ionicons name="hand-left" size={24} color="#007AFF" />
              </View>
              <Text style={styles.actionButtonTitle}>Get Help</Text>
              <Text style={styles.actionButtonSubtitle}>Request assistance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.helpOthersButton]}
              onPress={navigateToHelpOthers}
            >
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                <Ionicons name="people" size={24} color="#34C759" />
              </View>
              <Text style={styles.actionButtonTitle}>Help Others</Text>
              <Text style={styles.actionButtonSubtitle}>Browse requests</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Chats Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Communications</Text>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={navigateToMyChats}
            activeOpacity={0.7}
          >
            <View style={styles.chatButtonInner}>
              <View style={styles.chatIconSection}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}>
                  <Ionicons name="chatbubbles" size={28} color="#5856D6" />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.chatContent}>
                <View style={styles.chatTextContent}>
                  <Text style={styles.chatButtonTitle}>My Chats</Text>
                  <Text style={styles.chatButtonSubtitle}>
                    {unreadCount > 0
                      ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
                      : 'View your conversations'}
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={24} color="#5856D6" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
    </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#007AFF',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 20,
  },
  profileCard: {
    margin: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flex: 1,
  },
  viewProfileButton: {
    padding: 8,
    borderRadius: 20,
  },
  statsContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  getHelpButton: {},
  helpOthersButton: {},
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  chatButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  chatButtonInner: {
    flexDirection: 'column',
  },
  chatIconSection: {
    padding: 20,
    paddingBottom: 0,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  chatContent: {
    padding: 20,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatTextContent: {
    flex: 1,
  },
  chatButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  chatButtonSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  arrowContainer: {
    backgroundColor: 'rgba(88, 86, 214, 0.1)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
});