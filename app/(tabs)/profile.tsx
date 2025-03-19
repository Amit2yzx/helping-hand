import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import UserStats from '../../components/UserStats';

export default function ProfilePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) {
        router.replace('/auth/login' as any);
        return;
      }

      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUserData(userSnap.data());
        } else {
          Alert.alert('Profile not found', 'Please complete your profile setup.');
          router.push('/profile' as any);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/auth/login' as any);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#007AFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{userData?.username?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{userData?.username || 'User'}</Text>
            <Text style={styles.details}>Age: {userData?.age || 'N/A'}</Text>
            <Text style={styles.details}>Gender: {userData?.gender || 'N/A'}</Text>
            <View style={styles.trophyInline}>
              <Ionicons name="trophy" size={18} color="#FFD700" />
              <Text style={styles.trophyText}>{userData?.trophies || 0} Trophies</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.profileNote}>
          <Ionicons name="information-circle-outline" size={18} color="#666" />
          <Text style={styles.profileNoteText}>Profile information cannot be edited after initial setup.</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Trophy Stats</Text>
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={32} color="#FFD700" />
          <Text style={styles.statNumber}>{userData?.trophies || 0}</Text>
          <Text style={styles.statDescription}>Trophies Earned</Text>
        </View>
        <View style={styles.trophyInfo}>
          <Text style={styles.trophyInfoText}>
            Trophies are awarded when you help others successfully with their requests. 
            Keep helping to earn more trophies!
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/help-requests' as any)}
        >
          <Ionicons name="hand-right-outline" size={22} color="#4CAF50" />
          <Text style={styles.actionText}>Help Requests</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/chats' as any)}
        >
          <Ionicons name="chatbubbles-outline" size={22} color="#9C27B0" />
          <Text style={styles.actionText}>My Chats</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  logoutText: {
    marginLeft: 5,
    color: '#007AFF',
    fontWeight: '500',
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 20,
    marginTop: 10,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  avatarText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  details: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  trophyInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  trophyText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  profileNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 15,
  },
  profileNoteText: {
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 20,
    marginTop: 0,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  statDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  trophyInfo: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  trophyInfoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionsContainer: {
    padding: 20,
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
}); 