import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { auth, db } from '../firebaseConfig';
import { useRouter } from 'expo-router';
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function PostRequestPage() {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General Help');
  const [estimatedTime, setEstimatedTime] = useState(30); // Default to 30 minutes
  const router = useRouter();

  const categories = [
    'General Help',
    'Consulting',
    'Counseling',
    'Editing',
    'Small Development/Support',
    'Artwork',
  ];
  
  const timeOptions = [
    { label: '10 minutes', value: 10 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
  ];

  const handlePostRequest = async () => {
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Please provide a description for your request.');
      return;
    }
    if (!category) {
      Alert.alert('Validation Error', 'Please select a category.');
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const requestData = {
          requesterId: currentUser.uid,
          description: description.trim(),
          category: category,
          estimatedTime: estimatedTime,
          status: 'open',
          createdAt: new Date(),
        };

        const docRef = await addDoc(collection(db, 'requests'), requestData);
        console.log('Document written with ID: ', docRef.id);
        
        // Increment the requestsMade counter for the user
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const requestsMade = userData.requestsMade || 0;
            
            await updateDoc(userRef, {
              requestsMade: requestsMade + 1
            });
          }
        } catch (err) {
          console.error('Error updating requestsMade counter:', err);
          // Continue anyway since the request was posted
        }
        
        Alert.alert('Success', 'Your help request has been posted!');
        router.push('/home'); // Navigate back to the home screen
      } else {
        Alert.alert('Authentication Error', 'You must be logged in to post a request.');
      }
    } catch (error: any) {
      console.error('Error adding document: ', error);
      Alert.alert('Error', 'Failed to post your request. Please try again later.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Post a New Help Request</Text>

      <Text style={styles.label}>Description:</Text>
      <TextInput
        style={styles.input}
        placeholder="Describe what help you need"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Category:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={category}
          onValueChange={(itemValue) => setCategory(itemValue)}
          style={styles.picker}
          itemStyle={Platform.OS === 'ios' ? styles.pickerItemIOS : {}}
        >
          {categories.map((cat) => (
            <Picker.Item key={cat} label={cat} value={cat} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Estimated Time:</Text>
      <View style={styles.timeOptionsContainer}>
        {timeOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.timeOption,
              estimatedTime === option.value && styles.selectedTimeOption
            ]}
            onPress={() => setEstimatedTime(option.value)}
          >
            <Text 
              style={[
                styles.timeOptionText,
                estimatedTime === option.value && styles.selectedTimeOptionText
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.postButton} onPress={handlePostRequest}>
        <Text style={styles.postButtonText}>Post Request</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 15,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  pickerItemIOS: {
    fontSize: 16,
    height: 120,
  },
  timeOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  timeOption: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    width: '48%',
    alignItems: 'center',
  },
  selectedTimeOption: {
    backgroundColor: '#007AFF',
  },
  timeOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedTimeOptionText: {
    color: 'white',
  },
  postButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 30,
  },
  postButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});