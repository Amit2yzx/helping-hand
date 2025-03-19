import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

interface ChatWithDetails {
  id: string;
  requestId: string;
  participants: {
    helperId: string;
    requesterId: string;
  };
  createdAt: any;
  status: 'active' | 'completed' | 'cancelled';
  lastMessage?: {
    text: string;
    timestamp: any;
  };
  requestDetails?: {
    category: string;
    description: string;
    status: 'open' | 'in_progress' | 'completed';
  };
  otherUserName?: string;
  unreadCount?: {
    [userId: string]: number;
  };
  lastReadTimestamp?: {
    [userId: string]: any;
  };
}

export default function ChatsPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useSimpleQuery, setUseSimpleQuery] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      setIsLoading(false);
      return;
    }

    const userId = auth.currentUser.uid;

    // Try the advanced query with ordering first
    if (!useSimpleQuery) {
      // Query for all chats (both active and completed)
      const q = query(
        collection(db, 'chats'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q, 
        async (snapshot) => {
          try {
            // Filter for chats where the current user is a participant
            const userChats = snapshot.docs.filter(doc => {
              const data = doc.data();
              return (
                data.participants.helperId === userId || 
                data.participants.requesterId === userId
              );
            });

            const chatPromises = userChats.map(async (chatDoc) => {
              const chatData = { 
                id: chatDoc.id, 
                ...chatDoc.data() 
              } as ChatWithDetails;
              
              // Get last message if any
              try {
                const messagesQuery = query(
                  collection(db, 'messages'),
                  where('chatId', '==', chatDoc.id),
                  orderBy('timestamp', 'desc'),
                  limit(1)
                );
                
                const messagesSnapshot = await getDocs(messagesQuery);
                if (!messagesSnapshot.empty && messagesSnapshot.docs.length > 0) {
                  const lastMessageDoc = messagesSnapshot.docs[0];
                  const lastMessageData = lastMessageDoc.data();
                  chatData.lastMessage = {
                    text: lastMessageData.text,
                    timestamp: lastMessageData.timestamp
                  };
                }
              } catch (error) {
                console.log('Error getting last message:', error);
                // Just continue without the last message if there's an error
              }

              // Get request details and other user data
              await enrichChatData(chatData, userId);

              return chatData;
            });

            const chatsWithDetails = await Promise.all(chatPromises);
            setChats(chatsWithDetails);
          } catch (error) {
            console.error('Error processing chats:', error);
            Alert.alert('Error', 'Failed to load chats. Please try again.');
          } finally {
            setIsLoading(false);
          }
        },
        (error) => {
          console.error('Error in chats snapshot:', error);
          if (error.code === 'failed-precondition') {
            console.log('Index not ready, falling back to simple query');
            setUseSimpleQuery(true);
          } else {
            Alert.alert(
              'Error',
              'Unable to load chats. Please try again later.'
            );
            setIsLoading(false);
            setChats([]);
          }
        }
      );

      return () => unsubscribe();
    } else {
      // Fallback to a simple query without ordering
      console.log('Using simple query for chats without ordering');
      const q = query(collection(db, 'chats'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          // Filter for chats where the current user is a participant
          const userChats = snapshot.docs.filter(doc => {
            const data = doc.data();
            return (
              data.participants.helperId === userId || 
              data.participants.requesterId === userId
            );
          });

          const chatPromises = userChats.map(async (chatDoc) => {
            const chatData = { 
              id: chatDoc.id, 
              ...chatDoc.data() 
            } as ChatWithDetails;
            
            // Don't try to get last message in simple mode to avoid issues
            
            // Get request details and other user data
            await enrichChatData(chatData, userId);
            
            return chatData;
          });

          const chatsWithDetails = await Promise.all(chatPromises);
          
          // Sort in memory based on createdAt
          chatsWithDetails.sort((a, b) => {
            if (!a.createdAt || !b.createdAt) return 0;
            return b.createdAt.seconds - a.createdAt.seconds;
          });
          
          setChats(chatsWithDetails);
        } catch (error) {
          console.error('Error processing chats in simple mode:', error);
          Alert.alert('Error', 'Failed to load chats. Please try again.');
        } finally {
          setIsLoading(false);
        }
      });
      
      return () => unsubscribe();
    }
  }, [useSimpleQuery]);

  // Helper function to get request details and other user data
  const enrichChatData = async (chatData: ChatWithDetails, userId: string) => {
    // Get request details
    if (chatData.requestId) {
      try {
        const requestDocRef = doc(db, 'requests', chatData.requestId);
        const requestSnapshot = await getDoc(requestDocRef);
        
        if (requestSnapshot.exists()) {
          const requestData = requestSnapshot.data();
          chatData.requestDetails = {
            category: (requestData as any).category || 'Unknown Category',
            description: (requestData as any).description || 'No description available',
            status: (requestData as any).status || 'open'
          };
        }
      } catch (error) {
        console.error('Error getting request details:', error);
      }
    }

    // Determine other user ID (the person you're chatting with)
    const otherUserId = chatData.participants.helperId === userId 
      ? chatData.participants.requesterId 
      : chatData.participants.helperId;

    // Get other user's name
    try {
      const userDocRef = doc(db, 'users', otherUserId);
      const userSnapshot = await getDoc(userDocRef);
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        chatData.otherUserName = (userData as any).displayName || 'Unknown User';
      }
    } catch (error) {
      console.error('Error getting user details:', error);
      chatData.otherUserName = 'Unknown User';
    }
  };

  const openChat = (chat: ChatWithDetails) => {
    router.push(`/chat/${chat.id}?requestId=${chat.requestId}` as any);
  };

  const renderChatItem = ({ item }: { item: ChatWithDetails }) => {
    const isHelper = item.participants.helperId === auth.currentUser?.uid;
    const chatRole = isHelper ? 'Helper' : 'Requester';
    const requestStatus = item.requestDetails?.status || 'open';
    const currentUserId = auth.currentUser?.uid || '';
    const unreadCount = item.unreadCount?.[currentUserId] || 0;
    
    return (
      <TouchableOpacity 
        style={[
          styles.chatCard,
          item.status === 'completed' && styles.completedChatCard,
          requestStatus === 'in_progress' && styles.inProgressChatCard,
          unreadCount > 0 && styles.unreadChatCard
        ]}
        onPress={() => openChat(item)}
      >
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <View style={styles.categoryContainer}>
              <Ionicons 
                name={getCategoryIcon(item.requestDetails?.category)} 
                size={24} 
                color="#007AFF" 
              />
              <Text style={styles.chatTitle}>
                {item.requestDetails?.category || 'Chat'}
              </Text>
            </View>
            <View style={styles.statusContainer}>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
              <View style={[
                styles.statusBadge,
                item.status === 'active' ? styles.activeBadge : styles.completedBadge
              ]}>
                <Text style={styles.statusText}>
                  {item.status === 'active' ? 'Active' : 'Completed'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.userInfoContainer}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.otherUserName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            </View>
            <View style={styles.userDetails}>
              <Text style={[
                styles.userName,
                unreadCount > 0 && styles.unreadText
              ]}>
                {item.otherUserName}
              </Text>
              <Text style={styles.userRole}>{chatRole}</Text>
            </View>
            {requestStatus === 'in_progress' && (
              <View style={styles.progressBadge}>
                <Text style={styles.progressText}>In Progress</Text>
              </View>
            )}
          </View>

          <View style={styles.messagePreview}>
            <Text style={[
              styles.previewText,
              unreadCount > 0 && styles.unreadText
            ]} numberOfLines={2}>
              {item.lastMessage?.text || item.requestDetails?.description || 'No description available'}
            </Text>
          </View>

          <View style={styles.chatFooter}>
            {item.lastMessage && (
              <Text style={[
                styles.lastMessage,
                unreadCount > 0 && styles.unreadText
              ]} numberOfLines={1}>
                <Text style={styles.lastMessageLabel}>Last message: </Text>
                {item.lastMessage.text}
              </Text>
            )}
            <Text style={[
              styles.chatDate,
              unreadCount > 0 && styles.unreadText
            ]}>
              {formatDate(item.lastMessage?.timestamp?.toDate() || item.createdAt?.toDate())}
            </Text>
          </View>
        </View>
        <View style={styles.chatArrow}>
          <Ionicons name="chevron-forward" size={24} color="#007AFF" />
        </View>
      </TouchableOpacity>
    );
  };

  // Helper function to format date
  const formatDate = (date: Date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Helper function to get category icon
  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'technology':
        return 'laptop-outline';
      case 'education':
        return 'school-outline';
      case 'health':
        return 'medical-outline';
      case 'daily tasks':
        return 'calendar-outline';
      default:
        return 'help-circle-outline';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!auth.currentUser) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Please log in to view your chats</Text>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => router.push('/auth/login' as any)}
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>My Chats</Text>
      </View>

      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No chats found</Text>
            <Text style={styles.emptySubtext}>
              Start helping others or request help to begin chatting
            </Text>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => router.push('/help-requests' as any)}
            >
              <Text style={styles.helpButtonText}>Browse Help Requests</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  chatList: {
    padding: 16,
  },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  completedChatCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  inProgressChatCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  chatContent: {
    flex: 1,
    padding: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  completedBadge: {
    backgroundColor: '#E5E7EB',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D97706',
  },
  messagePreview: {
    marginBottom: 12,
  },
  previewText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  chatFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  lastMessageLabel: {
    fontWeight: '500',
    color: '#4B5563',
  },
  chatDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  chatArrow: {
    justifyContent: 'center',
    paddingRight: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  helpButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  unreadChatCard: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadText: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
}); 