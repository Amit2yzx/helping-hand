import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot, addDoc, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseHelpers } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

interface Request {
  id: string;
  category: string;
  description: string;
  estimatedTime: number;
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

export default function HelpRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [useSimpleQuery, setUseSimpleQuery] = useState(false);
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const categories = [
    'General Help',
    'Consulting',
    'Counseling',
    'Editing',
    'Small Development/Support',
    'Artwork',
  ];
  
  const timeFilters = [
    { label: '10 mins or less', value: 10 },
    { label: '15 mins or less', value: 15 },
    { label: '30 mins or less', value: 30 },
    { label: '1 hour or less', value: 60 },
  ];

  useEffect(() => {
    // Try the advanced query first
    if (!useSimpleQuery) {
      try {
        const q = query(
          collection(db, 'requests'),
          where('status', 'in', ['open', 'in_progress']),
          orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const requestList = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Request[];
            setRequests(requestList);
            setFilteredRequests(requestList);
            setIsLoading(false);
          },
          (error) => {
            console.error('Error in requests snapshot:', error);
            if (error.code === 'failed-precondition') {
              console.log('Index not ready, falling back to simple query');
              setUseSimpleQuery(true);
            } else {
              Alert.alert(
                'Error',
                'Unable to load help requests. Please try again later.'
              );
              setIsLoading(false);
              setRequests([]);
              setFilteredRequests([]);
            }
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up advanced query:', error);
        setUseSimpleQuery(true);
      }
    } else {
      // Use a simpler query without the compound index requirement
      console.log('Using simple query without ordering');
      const q = query(collection(db, 'requests'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allRequests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Request[];
        
        // Filter in memory instead of in the query
        const filteredRequests = allRequests.filter(req => 
          req.status === 'open' || req.status === 'in_progress'
        );
        
        // Sort in memory
        filteredRequests.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.seconds - a.createdAt.seconds;
        });
        
        setRequests(filteredRequests);
        setFilteredRequests(filteredRequests);
        setIsLoading(false);
        
        // Show a notification about limited functionality
        Alert.alert(
          'Limited Functionality',
          'The app is running in compatibility mode while the database is being set up. Some features may be limited. This is temporary and will be resolved shortly.',
          [{ text: 'OK' }]
        );
      });
      
      return () => unsubscribe();
    }
  }, [useSimpleQuery]);
  
  // Apply filters whenever filter criteria or requests change
  useEffect(() => {
    if (requests.length === 0) {
      setFilteredRequests([]);
      return;
    }
    
    let result = [...requests];
    
    // Apply category filter if selected
    if (selectedCategory) {
      result = result.filter(req => req.category === selectedCategory);
    }
    
    // Apply time filter if selected
    if (selectedTimeFilter) {
      result = result.filter(req => req.estimatedTime <= selectedTimeFilter);
    }
    
    setFilteredRequests(result);
  }, [requests, selectedCategory, selectedTimeFilter]);
  
  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTimeFilter(null);
  };

  const startChat = async (request: Request) => {
    if (startingChat) {
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in to start a chat');
      return;
    }

    if (!request.requesterId) {
      console.error('Request does not have a valid requesterId:', request);
      Alert.alert('Error', 'Cannot start chat with this request. Missing user information.');
      return;
    }

    if (auth.currentUser.uid === request.requesterId) {
      Alert.alert('Info', 'This is your own request. You cannot start a chat with yourself.');
      return;
    }

    if (request.status === 'in_progress' && request.helperId !== auth.currentUser.uid) {
      Alert.alert('Info', 'This request is already being helped by someone else.');
      return;
    }

    setStartingChat(request.id);

    try {
      // First, check if a chat already exists
      const existingChatsQuery = query(
        collection(db, 'chats'),
        where('requestId', '==', request.id),
        where('participants.helperId', '==', auth.currentUser.uid)
      );

      const existingChats = await getDocs(existingChatsQuery);
      
      if (!existingChats.empty) {
        const chatId = existingChats.docs[0].id;
        router.push(`/chat/${chatId}?requestId=${request.id}` as any);
        return;
      }

      // Update the request to 'in_progress'
      try {
        await firebaseHelpers.updateDocument('requests', request.id, {
          status: 'in_progress',
          helperId: auth.currentUser.uid
        });
      } catch (error) {
        console.error('Error updating request status:', error);
        Alert.alert('Error', 'Failed to update request status. Please try again.');
        setStartingChat(null);
        return;
      }

      // Update the helper's requestsHelped counter
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const requestsHelped = userData.requestsHelped || 0;
          
          await firebaseHelpers.updateDocument('users', auth.currentUser.uid, {
            requestsHelped: requestsHelped + 1
          });
        }
      } catch (err) {
        console.error('Error updating requestsHelped counter:', err);
        // Continue anyway since this isn't critical
      }

      // Create the chat document
      const chatData: Omit<Chat, 'id'> = {
        requestId: request.id,
        participants: {
          helperId: auth.currentUser.uid,
          requesterId: request.requesterId
        },
        createdAt: new Date(),
        status: 'active'
      };

      console.log('Creating chat with data:', JSON.stringify(chatData));

      try {
        const chatId = await firebaseHelpers.addDocument('chats', chatData);
        if (chatId) {
          router.push(`/chat/${chatId}?requestId=${request.id}` as any);
        } else {
          throw new Error('Failed to create chat');
        }
      } catch (error) {
        console.error('Error creating chat document:', error);
        
        // If chat creation fails, try to revert the request status
        try {
          await firebaseHelpers.updateDocument('requests', request.id, {
            status: 'open',
            helperId: null
          });
        } catch (revertError) {
          console.error('Error reverting request status:', revertError);
        }
        
        Alert.alert('Error', 'Failed to create chat. Please try again.');
        setStartingChat(null);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
      setStartingChat(null);
    }
  };

  const renderItem = ({ item }: { item: Request }) => {
    const isMyRequest = item.requesterId === auth.currentUser?.uid;
    const isInProgress = item.status === 'in_progress';
    const amIHelper = isInProgress && item.helperId === auth.currentUser?.uid;
    const isDisabled = startingChat !== null || (isInProgress && !amIHelper) || isMyRequest;
    
    return (
      <TouchableOpacity 
        style={[
          styles.requestCard,
          isInProgress && styles.inProgressCard
        ]}
        onPress={() => startChat(item)}
        disabled={isDisabled}
      >
        <View style={styles.requestHeader}>
          <Text style={styles.category}>{item.category}</Text>
          
          {isInProgress && (
            <View style={styles.statusBadge}>
              <Ionicons name="time-outline" size={16} color="white" />
              <Text style={styles.statusText}>In Progress</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.description}>{item.description}</Text>
        
        <View style={styles.timeEstimate}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.timeText}>
            {item.estimatedTime} {item.estimatedTime === 60 ? 'hour' : 'mins'}
          </Text>
        </View>
        
        {isMyRequest ? (
          <View style={styles.myRequestBadge}>
            <Text style={styles.myRequestText}>Your Request</Text>
          </View>
        ) : (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[
                styles.helpButton,
                isInProgress && !amIHelper && styles.disabledButton,
                startingChat === item.id && styles.loadingButton,
                amIHelper && styles.activeButton
              ]}
              onPress={() => startChat(item)}
              disabled={isDisabled}
            >
              {startingChat === item.id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  {amIHelper ? (
                    <>
                      <Ionicons name="chatbubbles-outline" size={18} color="white" />
                      <Text style={styles.helpButtonText}>Continue Chat</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="hand-right-outline" size={18} color="white" />
                      <Text style={styles.helpButtonText}>
                        {isInProgress ? 'Being Helped' : 'Help with This'}
                      </Text>
                    </>
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Help Requests</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter" size={20} color={showFilters ? "#007AFF" : "#666"} />
          <Text style={[styles.filterButtonText, showFilters && styles.activeFilterText]}>Filters</Text>
        </TouchableOpacity>
      </View>
      
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Filter by Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryFilter,
                    selectedCategory === cat && styles.selectedCategoryFilter
                  ]}
                  onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  <Text 
                    style={[
                      styles.categoryFilterText,
                      selectedCategory === cat && styles.selectedCategoryFilterText
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Filter by Time:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {timeFilters.map((time) => (
                <TouchableOpacity
                  key={time.value}
                  style={[
                    styles.timeFilter,
                    selectedTimeFilter === time.value && styles.selectedTimeFilter
                  ]}
                  onPress={() => setSelectedTimeFilter(selectedTimeFilter === time.value ? null : time.value)}
                >
                  <Text 
                    style={[
                      styles.timeFilterText,
                      selectedTimeFilter === time.value && styles.selectedTimeFilterText
                    ]}
                  >
                    {time.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {(selectedCategory || selectedTimeFilter) && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading help requests...</Text>
        </View>
      ) : filteredRequests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={50} color="#ccc" />
          <Text style={styles.emptyTitle}>No Requests Found</Text>
          <Text style={styles.emptyText}>
            {selectedCategory || selectedTimeFilter 
              ? "Try removing some filters to see more requests." 
              : "There are no open help requests at the moment."}
          </Text>
          
          {(selectedCategory || selectedTimeFilter) && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  filterButtonText: {
    fontSize: 14,
    marginLeft: 5,
    fontWeight: '500',
    color: '#666',
  },
  activeFilterText: {
    color: '#007AFF',
  },
  filtersContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterSection: {
    marginVertical: 8,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  categoriesScroll: {
    marginBottom: 5,
  },
  categoryFilter: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 10,
  },
  selectedCategoryFilter: {
    backgroundColor: '#007AFF',
  },
  categoryFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  selectedCategoryFilterText: {
    color: 'white',
  },
  timeFilter: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 10,
  },
  selectedTimeFilter: {
    backgroundColor: '#007AFF',
  },
  timeFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  selectedTimeFilterText: {
    color: 'white',
  },
  clearFiltersButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  listContainer: {
    padding: 15,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inProgressCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#FF9500',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  category: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
    color: 'white',
    fontWeight: '500',
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  myRequestBadge: {
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  myRequestText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  loadingButton: {
    backgroundColor: '#007AFF',
  },
  activeButton: {
    backgroundColor: '#9C27B0',
  },
  helpButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 5,
  },
}); 