# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Recent Updates and Features

### Chat Functionality Fixes
We've fixed several issues with the chat functionality:

1. **Improved Chat Completion and Trophy System**: The app now correctly marks chats as completed and awards trophies to helpers when requesters complete a request.

2. **Fixed Leave Chat Functionality**: Users can now leave chats successfully. If a requester leaves, the help request is automatically reopened.

3. **Enhanced Error Handling**: We've implemented direct Firestore operations with proper error handling for critical chat functions to ensure reliability.

### Image Functionality Updates

1. **Simplified Request Creation**: The image attachment option has been removed from help requests to streamline the request creation process.

2. **Image Sharing in Chats**: Users can now share images in chat conversations with the following features:
   - 400KB size limit per image to ensure efficient loading
   - Preview of images within the chat interface
   - Simple attachment button in the message input area
   - File size validation to prevent oversized uploads

### Deploying Firestore and Storage Rules

To ensure proper functionality and security, you need to deploy the included Firebase rules:

1. Install the Firebase CLI if you haven't already:
   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```
   firebase login
   ```

3. Initialize Firebase in your project directory (if not already done):
   ```
   firebase init
   ```
   - Select Firestore and Storage when prompted
   - Choose to use an existing project and select your Firebase project

4. Deploy the rules:
   ```
   firebase deploy --only firestore:rules,storage
   ```

This will update your Firebase security rules to properly secure your database and storage while allowing the operations needed for your app functionality.
