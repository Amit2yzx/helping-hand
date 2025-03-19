import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function DebugPage() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigation Debug Page</Text>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Go to Signup" 
          onPress={() => router.push('/')} 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Go to Login" 
          onPress={() => router.push('/auth/login')} 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Go to Profile" 
          onPress={() => router.push('/profile')} 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Go to Home" 
          onPress={() => router.push('/(tabs)/home')} 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Go to Post Request" 
          onPress={() => router.push('/post-request')} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '80%',
    marginVertical: 10,
  }
}); 