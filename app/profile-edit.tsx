import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

export default function ProfileEditPage() {
  const router = useRouter();

  useEffect(() => {
    // Show alert and redirect to profile page
    Alert.alert(
      'Profile Editing Disabled',
      'Profile information cannot be edited after initial setup.',
      [
        { 
          text: 'Return to Profile', 
          onPress: () => router.replace('/(tabs)/profile')
        }
      ],
      { cancelable: false }
    );
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Redirecting to profile page...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  }
}); 