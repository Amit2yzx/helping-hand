import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import { auth } from '../../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Link, useRouter } from 'expo-router'; // Import useRouter
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(true);
  const router = useRouter(); // Initialize the router
  const db = getFirestore(auth.app);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      if (auth.currentUser) {
        // Check if profile is set
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          const hasProfile = docSnap.exists() && docSnap.data()?.profileSet === true;

          if (hasProfile) {
            router.replace('/(tabs)' as any);
          } else {
            router.replace('/profile' as any);
          }
        } catch (error) {
          console.error('Error checking profile:', error);
          router.replace('/profile' as any); // Default to profile setup on error
        }
      } else {
        setChecking(false); // Not logged in, show the login form
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if profile is set
      const userDocRef = doc(db, 'users', user.uid);
      try {
        const docSnap = await getDoc(userDocRef);
        const hasProfile = docSnap.exists() && docSnap.data()?.profileSet === true;

        if (hasProfile) {
          router.replace('/(tabs)' as any);
        } else {
          router.replace('/profile' as any);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        router.replace('/profile' as any); // Default to profile setup on error
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title="Log In" onPress={handleLogin} />

      <Text style={styles.linkText}>
        Don't have an account? <Link href={'/'}>Sign Up</Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '80%',
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  linkText: {
    marginTop: 20,
    color: 'blue',
  },
}); 