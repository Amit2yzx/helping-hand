// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
// Import other Firebase modules as needed (e.g., firestore, storage)
import { getFirestore, doc, updateDoc, addDoc, collection, serverTimestamp, increment } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCOmOnqVtEzA83EbuF6UhL5XGIanvdXF2w",
  authDomain: "hhand-78382.firebaseapp.com",
  projectId: "hhand-78382",
  storageBucket: "hhand-78382.firebasestorage.app",
  messagingSenderId: "195875358330",
  appId: "1:195875358330:web:255a2a0e62c6091c25ddc3",
  measurementId: "G-2QCDBTPJMN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);

// ImgBB API Key - Replace with your actual API key
const IMGBB_API_KEY = 'b96aa19b89692916945f9f8f51dc703d';

// Helper function to upload image to ImgBB
export const uploadImageToImgBB = async (imageUri) => {
  try {
    console.log('Starting image upload to ImgBB...');
    
    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    console.log('Image blob size:', blob.size);
    
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64String = reader.result;
          // Remove the data:image/jpeg;base64, prefix
          const base64Data = base64String.split(',')[1] || base64String;
          console.log('Base64 conversion successful, length:', base64Data.length);
          resolve(base64Data);
        } catch (err) {
          console.error('Error processing base64:', err);
          reject(err);
        }
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(err);
      };
      reader.readAsDataURL(blob);
    });

    // Create form data for ImgBB
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64);
    console.log('Uploading to ImgBB with API key:', IMGBB_API_KEY);

    // Upload to ImgBB
    const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    console.log('ImgBB response status:', uploadResponse.status);
    const data = await uploadResponse.json();
    console.log('ImgBB response data:', JSON.stringify(data));
    
    if (data.success) {
      console.log('Image uploaded successfully to ImgBB:', data.data.url);
      return data.data.url; // This is the URL we'll store in Firestore
    } else {
      console.error('ImgBB upload failed:', data.error?.message || 'Unknown error');
      throw new Error(data.error?.message || 'Upload failed');
    }
  } catch (error) {
    console.error('Error uploading image to ImgBB:', error);
    throw error;
  }
};

// Helper functions for common Firestore operations with better error handling
export const firebaseHelpers = {
  // Update a document with retry logic
  updateDocument: async (collectionPath, documentId, data, maxRetries = 3) => {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const docRef = doc(db, collectionPath, documentId);
        await updateDoc(docRef, data);
        console.log(`Document ${documentId} in ${collectionPath} updated successfully`);
        return true;
      } catch (error) {
        console.error(`Error updating document (retry ${retries + 1}/${maxRetries}):`, error);
        retries++;
        if (retries >= maxRetries) {
          console.error('Maximum retries reached. Operation failed.');
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
    return false;
  },

  // Add a document with retry logic
  addDocument: async (collectionPath, data, maxRetries = 3) => {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const docRef = await addDoc(collection(db, collectionPath), data);
        console.log(`Document added to ${collectionPath} with ID: ${docRef.id}`);
        return docRef.id;
      } catch (error) {
        console.error(`Error adding document (retry ${retries + 1}/${maxRetries}):`, error);
        retries++;
        if (retries >= maxRetries) {
          console.error('Maximum retries reached. Operation failed.');
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
    return null;
  },

  // Add a system message to a chat
  addSystemMessage: async (chatId, text) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');
      
      const messageData = {
        chatId,
        senderId: 'system',
        text: text,
        timestamp: serverTimestamp(),
        readBy: [currentUser.uid]
      };
      
      return await firebaseHelpers.addDocument('messages', messageData);
    } catch (error) {
      console.error('Error adding system message:', error);
      return null;
    }
  },

  // Leave a chat with proper status updates
  leaveChat: async (chatId, requestId, isRequester) => {
    try {
      // First update the chat status
      await firebaseHelpers.updateDocument('chats', chatId, {
        status: 'cancelled'
      });
      
      // Add a system message
      const role = isRequester ? 'Requester' : 'Helper';
      await firebaseHelpers.addSystemMessage(chatId, `${role} has left the chat.`);
      
      // If requester is leaving, try to reopen the request
      if (isRequester && requestId) {
        try {
          await firebaseHelpers.updateDocument('requests', requestId, {
            status: 'open',
            helperId: null
          });
          await firebaseHelpers.addSystemMessage(chatId, 'The request has been reopened and is available for others to help.');
        } catch (reopenError) {
          console.error('Error reopening request:', reopenError);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error leaving chat:', error);
      return false;
    }
  },

  // Mark a chat as completed
  markChatCompleted: async (chatId, requestId, giveTrophy = false, helperId = null) => {
    try {
      // Update the chat status
      await firebaseHelpers.updateDocument('chats', chatId, {
        status: 'completed',
        completedAt: serverTimestamp()
      });
      
      // Update the request status
      if (requestId) {
        await firebaseHelpers.updateDocument('requests', requestId, {
          status: 'completed'
        });
      }
      
      // Add a system message
      await firebaseHelpers.addSystemMessage(chatId, 'This chat has been marked as completed. The help request has been fulfilled.');
      
      // Award trophy if needed
      if (giveTrophy && helperId) {
        try {
          // Get the helper's trophy count and increment
          const helperRef = doc(db, 'users', helperId);
          await updateDoc(helperRef, {
            trophies: increment(1)
          });
          
          await firebaseHelpers.addSystemMessage(chatId, '🏆 A trophy has been awarded to the helper for their assistance!');
        } catch (trophyError) {
          console.error('Error awarding trophy:', trophyError);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error marking chat as completed:', error);
      return false;
    }
  }
};

export default app;