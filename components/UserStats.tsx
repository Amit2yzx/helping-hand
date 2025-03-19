import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

interface UserStatsProps {
  userId?: string; // If not provided, will use current user
  showTrophiesOnly?: boolean;
  compact?: boolean;
  showUserInfo?: boolean;
}

export default function UserStats({ userId, showTrophiesOnly = false, compact = false, showUserInfo = false }: UserStatsProps) {
  const [userData, setUserData] = useState<{
    displayName?: string;
    age?: string;
    gender?: string;
    trophies?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const uid = userId || auth.currentUser?.uid;
      if (!uid) {
        setIsLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserData({
            displayName: data.displayName,
            age: data.age,
            gender: data.gender,
            trophies: data.trophies || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User data not available</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name="trophy" size={20} color="#FFD700" />
        <Text style={styles.compactText}>{userData.trophies}</Text>
      </View>
    );
  }

  if (showUserInfo) {
    return (
      <View style={styles.userInfoContainer}>
        <Text style={styles.username}>{userData.displayName || 'User'}</Text>
        <View style={styles.userDetails}>
          {userData.age && <Text style={styles.userDetail}>Age: {userData.age}</Text>}
          {userData.gender && <Text style={styles.userDetail}>Gender: {userData.gender}</Text>}
        </View>
      </View>
    );
  }

  if (showTrophiesOnly) {
    return (
      <View style={styles.statCard}>
        <Text style={styles.statTitle}>Trophies</Text>
        <View style={styles.statValue}>
          <Ionicons name="trophy" size={32} color="#FFD700" />
          <Text style={styles.statNumber}>{userData.trophies}</Text>
        </View>
        <Text style={styles.statDescription}>
          Earned by helping others successfully
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {userData.displayName && (
        <View style={styles.userInfoCard}>
          <Text style={styles.usernameTitle}>{userData.displayName}</Text>
          <View style={styles.userDetailsRow}>
            {userData.age && <Text style={styles.userAge}>Age: {userData.age}</Text>}
            {userData.gender && <Text style={styles.userAge}>Gender: {userData.gender}</Text>}
          </View>
        </View>
      )}
      
      <View style={styles.statCard}>
        <Text style={styles.statTitle}>Trophies</Text>
        <View style={styles.statValue}>
          <Ionicons name="trophy" size={32} color="#FFD700" />
          <Text style={styles.statNumber}>{userData.trophies}</Text>
        </View>
        <Text style={styles.statDescription}>
          Earned by helping others successfully
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#666',
    fontSize: 14,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  compactText: {
    marginLeft: 5,
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  userInfoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userDetails: {
    marginTop: 4,
  },
  userDetail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  userInfoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  usernameTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  userAge: {
    fontSize: 16,
    color: '#666',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  statDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
}); 