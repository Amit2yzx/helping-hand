import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

interface UserProfile {
  displayName: string;
  age: string;
  gender: string;
  bio: string;
  skills: string[];
  interests: string[];
  profileSet: boolean;
}

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [loading, setLoading] = useState(false);
  const [ageError, setAgeError] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      setDisplayName(data.displayName || '');
      setAge(data.age || '');
      setGender(data.gender || 'Male');
    }
    setLoading(false);
  };

  const validateAge = (age: string) => {
    const ageNum = parseInt(age);
    if (isNaN(ageNum)) {
      setAgeError('Please enter a valid number');
      return false;
    } else if (ageNum < 16) {
      setAgeError('You must be at least 16 years old to use this app');
      return false;
    } else if (ageNum > 120) {
      setAgeError('Please enter a valid age');
      return false;
    } else {
      setAgeError('');
      return true;
    }
  };

  const handleAgeChange = (value: string) => {
    setAge(value);
    if (value.trim() !== '') {
      validateAge(value);
    } else {
      setAgeError('');
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    if (!validateAge(age)) {
      return;
    }

    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: displayName,
        age: age,
        gender: gender,
        bio: '',
        skills: [],
        interests: [],
        profileSet: true,
        updatedAt: serverTimestamp()
      });

      Alert.alert('Success', 'Profile updated successfully');
      router.replace('/(tabs)' as any);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Tell us about yourself</Text>
      </View>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your full name"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Age (must be 16+)</Text>
      <TextInput
        style={[styles.input, ageError ? styles.inputError : null]}
        placeholder="Enter your age"
        value={age}
        onChangeText={handleAgeChange}
        keyboardType="numeric"
        maxLength={3}
      />
      {ageError ? <Text style={styles.errorText}>{ageError}</Text> : null}

      <Text style={styles.label}>Gender</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={gender}
          onValueChange={(itemValue) => setGender(itemValue)}
          style={styles.picker}
          itemStyle={Platform.OS === 'ios' ? styles.pickerItemIOS : {}}
        >
          <Picker.Item label="Male" value="Male" />
          <Picker.Item label="Female" value="Female" />
          <Picker.Item label="Other" value="Other" />
        </Picker>
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : 'Save Profile'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#007AFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    width: '100%',
    padding: 12,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ff3b30',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginVertical: 5,
  },
  picker: {
    width: '100%', 
    height: 50,
  },
  pickerItemIOS: {
    fontSize: 16,
    height: 120,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
