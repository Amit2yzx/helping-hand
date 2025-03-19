import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, getDocs, arrayUnion } from 'firebase/firestore';
import { auth, db, firebaseHelpers, uploadImageToImgBB } from '../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Message {
  id: string;
  senderId: string;
  timestamp: any;
  readBy: string[];
  type?: 'text' | 'image' | 'system';
  text?: string;
  imageUrl?: string;
  content?: string;
  chatId: string;
}

interface Request {
  id: string;
  category: string;
  description: string;
  estimatedTime: string;
  requesterId: string;
  createdAt: any;
  status: 'open' | 'in_progress' | 'completed';
  helperId?: string;
}

interface Chat {
  id: string;
  requestId: string;
  participants: {
    helperId: string;
    requesterId: string;
  };
  createdAt: any;
  status: 'active' | 'completed' | 'cancelled';
}

interface User {
  id: string;
  displayName?: string;
  email?: string;
  trophies?: number;
}

export default function ChatScreen() {
  const { chatId, requestId } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useSimpleQuery, setUseSimpleQuery] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    // Get chat info
    const fetchChatInfo = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId as string));
        if (chatDoc.exists()) {
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          setChat(chatData);
          
          // Get request info
          if (chatData.requestId) {
            const requestDoc = await getDoc(doc(db, 'requests', chatData.requestId));
            if (requestDoc.exists()) {
              setRequest({ id: requestDoc.id, ...requestDoc.data() } as Request);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching chat info:', error);
        Alert.alert(
          'Error',
          'Unable to load chat information. Please try again later.'
        );
      }
    };

    fetchChatInfo();

    // Attempt to use the optimized query with index first
    if (!useSimpleQuery) {
      // Listen for messages with ordering
      const q = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const messageList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];
          setMessages(messageList);
          setIsLoading(false);
        },
        (error) => {
          console.error('Error in messages snapshot:', error);
          if (error.code === 'failed-precondition') {
            console.log('Index not ready, falling back to simple query');
            setUseSimpleQuery(true);
          } else {
            Alert.alert(
              'Error',
              'Unable to load messages. Please try again later.'
            );
            setIsLoading(false);
          }
        }
      );

      return () => unsubscribe();
    } else {
      // Fallback to a simple query without ordering
      console.log('Using simple query for messages');
      const q = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messageList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        
        // Sort in memory based on timestamp
        messageList.sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return a.timestamp.seconds - b.timestamp.seconds;
        });
        
        setMessages(messageList);
        setIsLoading(false);
      });
      
      return () => unsubscribe();
    }
  }, [chatId, useSimpleQuery]);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    const currentUserId = auth.currentUser.uid;
    
    // Mark chat as read when opening
    const markChatAsRead = async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          const updates: any = {
            [`unreadCount.${currentUserId}`]: 0,
            [`lastReadTimestamp.${currentUserId}`]: serverTimestamp()
          };
          
          await updateDoc(chatRef, updates);
        }
      } catch (error) {
        console.error('Error marking chat as read:', error);
      }
    };

    // Set up message listener
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(newMessages);

      // Mark new messages as read
      const unreadMessages = snapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.readBy?.includes(currentUserId);
      });

      for (const messageDoc of unreadMessages) {
        try {
          await updateDoc(doc(db, 'messages', messageDoc.id), {
            readBy: arrayUnion(currentUserId)
          });
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      }
    });

    // Mark chat as read when opened
    markChatAsRead();

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;
    if (!chatId || !auth.currentUser || !chat || chat.status !== 'active') return;

    const currentUserId = auth.currentUser.uid;
    let imageUrl = '';

    try {
      if (selectedImage) {
        imageUrl = await uploadImageToImgBB(selectedImage);
      }

      // Create the message
      const messageData: Partial<Message> = {
        chatId: chatId as string,
        senderId: currentUserId,
        text: newMessage.trim() || (imageUrl ? '📷 Image' : ''),
        timestamp: serverTimestamp(),
        imageUrl,
        readBy: [currentUserId], // Mark as read by sender
        type: imageUrl ? 'image' : 'text'
      };

      // Add the message
      await addDoc(collection(db, 'messages'), messageData);

      // Update chat's last message and unread count
      const chatRef = doc(db, 'chats', chatId as string);
      const chatDoc = await getDoc(chatRef);
      
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        const otherUserId = chatData.participants.helperId === currentUserId
          ? chatData.participants.requesterId
          : chatData.participants.helperId;

        const updates: any = {
          lastMessage: {
            text: messageData.text,
            timestamp: serverTimestamp()
          },
          [`unreadCount.${otherUserId}`]: increment(1)
        };

        await updateDoc(chatRef, updates);
      }

      // Clear the input
      setNewMessage('');
      setSelectedImage(null);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const pickImage = async () => {
    if (chat?.status !== 'active') {
      Alert.alert('Error', 'This chat has ended. You cannot send new messages.');
      return;
    }

    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      const selectedAsset = result.assets[0];
      
      // Check file size (400KB limit = 400 * 1024 bytes)
      const fileInfo = await fetch(selectedAsset.uri).then(response => {
        return {
          size: parseInt(response.headers.get('Content-Length') || '0'),
          type: response.headers.get('Content-Type')
        };
      });
      
      if (fileInfo.size > 400 * 1024) {
        Alert.alert(
          'File Too Large', 
          'Please select an image smaller than 400KB. You might need to resize the image before uploading.'
        );
        return;
      }
      
      setSelectedImage(selectedAsset.uri);
      setIsUploading(true);
      try {
        await sendMessage();
      } finally {
        setIsUploading(false);
      }
    }
  };

  const uploadImage = async (uri: string) => {
    if (!auth.currentUser || !chatId || chat?.status !== 'active') {
      if (chat?.status !== 'active') {
        Alert.alert('Error', 'This chat has ended. You cannot send new messages.');
      }
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Upload to ImgBB and get URL
      const imageUrl = await uploadImageToImgBB(uri);
      
      // Create message with image
      const messageData = {
        chatId,
        senderId: auth.currentUser.uid,
        type: 'image',
        text: '📷 Image',
        imageUrl: imageUrl,
        timestamp: serverTimestamp(),
        readBy: [auth.currentUser.uid]
      };
      
      await firebaseHelpers.addDocument('messages', messageData);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const markChatAsCompleted = async (giveTrophy = false) => {
    if (!chatId || !auth.currentUser || !chat) return;
    
    setIsSubmitting(true);
    
    try {
      // Update the chat status directly
      const chatRef = doc(db, 'chats', chatId as string);
      await updateDoc(chatRef, {
        status: 'completed',
        completedAt: serverTimestamp()
      });
      
      // Update the request status
      if (chat.requestId) {
        const requestRef = doc(db, 'requests', chat.requestId);
        await updateDoc(requestRef, {
          status: 'completed',
          beingHelped: false,
          beingHelpedWith: false,
          completedAt: serverTimestamp()
        });
      }
      
      // Add a system message
      await addDoc(collection(db, 'messages'), {
        chatId,
        senderId: 'system',
        text: 'This chat has been marked as completed. The help request has been fulfilled.',
        timestamp: serverTimestamp(),
        readBy: [auth.currentUser.uid]
      });
      
      // Award trophy if requested and if user is requester
      if (giveTrophy && chat.participants.helperId) {
        try {
          // Add a system message about the trophy first
          await addDoc(collection(db, 'messages'), {
            chatId,
            senderId: 'system',
            text: '🏆 A trophy has been awarded to the helper for their assistance!',
            timestamp: serverTimestamp(),
            readBy: [auth.currentUser.uid]
          });
          
          // Update the helper's trophy count
          const helperRef = doc(db, 'users', chat.participants.helperId);
          await updateDoc(helperRef, {
            trophies: increment(1)
          });
        } catch (error) {
          console.error('Error awarding trophy:', error);
          // Continue even if trophy award fails
        }
      }
      
      Alert.alert(
        'Success',
        'This help request has been marked as completed. Thank you for the help!',
        [
          { 
            text: 'View All Chats', 
            onPress: () => router.push('/chats' as any)
          },
          {
            text: 'Stay in Chat',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error marking chat as completed:', error);
      Alert.alert('Error', 'Failed to mark chat as completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const leaveChat = async () => {
    if (!chatId || !auth.currentUser || !chat) return;
    
    setIsSubmitting(true);
    
    try {
      // Update the chat status directly
      const chatRef = doc(db, 'chats', chatId as string);
      await updateDoc(chatRef, {
        status: 'cancelled'
      });
      
      // Determine if user is requester or helper
      const isRequester = auth.currentUser.uid === chat.participants.requesterId;
      const role = isRequester ? 'Requester' : 'Helper';
      
      // Add a system message about who left
      await addDoc(collection(db, 'messages'), {
        chatId,
        senderId: 'system',
        text: `${role} has left the chat.`,
        timestamp: serverTimestamp(),
        readBy: [auth.currentUser.uid]
      });
      
      // Handle request status based on who left
      if (chat.requestId) {
        const requestRef = doc(db, 'requests', chat.requestId);
        
        // For both requester and helper leaving, set request back to open
        await updateDoc(requestRef, {
          status: 'open',
          helperId: null,  // Remove the helper ID
          beingHelped: false,  // Update being helped status
          beingHelpedWith: true  // Update being helped with status
        });
        
        // Add a notification about the request being reopened
        await addDoc(collection(db, 'messages'), {
          chatId,
          senderId: 'system',
          text: 'The request is now open for other helpers.',
          timestamp: serverTimestamp(),
          readBy: [auth.currentUser.uid]
        });
      }
      
      Alert.alert(
        'Chat Left',
        'You have left the chat successfully.',
        [{ 
          text: 'Go to Chats', 
          onPress: () => router.push('/chats' as any)
        }]
      );
    } catch (error) {
      console.error('Error leaving chat:', error);
      Alert.alert('Error', 'Failed to leave chat. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolutionOptions = () => {
    if (!auth.currentUser || !chat) return;
    
    const isRequester = auth.currentUser.uid === chat.participants.requesterId;
    const options: {
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }[] = [];
    
    if (chat.status === 'active') {
      if (isRequester) {
        options.push({
          text: 'Mark as Completed (Award Trophy)',
          onPress: () => markChatAsCompleted(true)
        });
        options.push({
          text: 'Mark as Completed (No Trophy)',
          onPress: () => markChatAsCompleted(false)
        });
      }
      
      options.push({
        text: 'Leave Chat',
        onPress: leaveChat,
        style: 'destructive'
      });
    }
    
    if (options.length === 0) {
      Alert.alert('Info', 'No actions available for the current chat status.');
      return;
    }
    
    options.push({
      text: 'Cancel',
      style: 'cancel'
    });
    
    Alert.alert('Chat Options', 'Choose an action:', options);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    // Special case for system messages
    if (item.senderId === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Text style={styles.systemMessageText}>
              {item.text}
            </Text>
            <Text style={styles.systemMessageTimestamp}>
              {item.timestamp?.toDate().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        </View>
      );
    }
    
    const isOwnMessage = item.senderId === auth.currentUser?.uid;
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble
        ]}>
          {item.type === 'image' && item.imageUrl && (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.messageImage}
              resizeMode="contain"
            />
          )}
          {item.text && (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.text}
            </Text>
          )}
          <Text style={[
            styles.timestamp,
            isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp
          ]}>
            {item.timestamp?.toDate().toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            {request?.category || 'Chat'}
          </Text>
          {request && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {request.description}
            </Text>
          )}
        </View>
        {chat?.status === 'active' && (
          <TouchableOpacity 
            style={styles.completeButton}
            onPress={handleResolutionOptions}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="ellipsis-horizontal" size={24} color="white" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {request && (
        <View style={styles.requestInfo}>
          <Text style={styles.requestCategory}>{request.category}</Text>
          <Text style={styles.requestDescription}>{request.description}</Text>
          <Text style={styles.requestTime}>Est. Time: {request.estimatedTime}</Text>
          {chat?.status !== 'active' && (
            <Text style={styles.chatEndedText}>
              {chat?.status === 'completed' ? 'This chat has been completed' : 'This chat has ended'}
            </Text>
          )}
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
          </View>
        }
      />

      {chat?.status === 'active' ? (
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={pickImage}
            disabled={isUploading}
          >
            <Ionicons 
              name="image-outline" 
              size={24} 
              color={isUploading ? "#999" : "#007AFF"} 
            />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
          />
          {isUploading ? (
            <ActivityIndicator style={styles.sendButton} size="small" color="#007AFF" />
          ) : (
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={newMessage.trim() ? '#007AFF' : '#999'} 
              />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.chatEndedContainer}>
          <Text style={styles.chatEndedMessage}>
            {chat?.status === 'completed' 
              ? 'This chat has been completed. No new messages can be sent.' 
              : 'This chat has ended. No new messages can be sent.'}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  requestInfo: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  requestCategory: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0084FF',
    marginBottom: 6,
  },
  requestDescription: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 6,
    lineHeight: 20,
  },
  requestTime: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  messagesList: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownBubble: {
    backgroundColor: '#0084FF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#F0F2F5',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#1A1A1A',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    alignItems: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 16,
    color: '#1A1A1A',
  },
  sendButton: {
    padding: 8,
    backgroundColor: 'transparent',
  },
  completeButton: {
    backgroundColor: '#22C55E',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    maxWidth: '85%',
  },
  systemMessageText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  systemMessageTimestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  messageImage: {
    width: 240,
    height: 240,
    borderRadius: 12,
    marginBottom: 8,
  },
  attachButton: {
    padding: 8,
    backgroundColor: 'transparent',
  },
  chatEndedContainer: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  chatEndedMessage: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  chatEndedText: {
    marginTop: 8,
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  }
}); 