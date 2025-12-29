
# e-Greetz: Personalized Cinematic Video Greetings

e-Greetz is a web application that allows users to create personalized cinematic video greetings for various occasions. Users can type or speak their message, upload an image, select a voice, and choose from cinematic background options powered by Google Gemini API for Text-to-Speech (TTS) and Video Generation. Greetings are saved and managed using Firebase.

## Features

*   **Occasion-based Greetings**: Create greetings for Happy Birthday, Merry Christmas, Happy Anniversary, Happy New Year, Promotions, and Graduations.
*   **Custom Message**: Type a message (up to 1000 words) or record it using your microphone.
*   **Image Upload**: Personalize greetings by uploading an image.
*   **AI Voice Selection**: Choose between male (Tenor, Bass) or female voices for the spoken message.
*   **Cinematic Video Backgrounds**: Automatically generated video backgrounds based on the selected occasion (e.g., balloons for birthday, fireworks for New Year).
*   **Greeting Management**: Save created greetings, view a list, and delete them.
*   **"created by e-Greetz" Watermark**: Each generated greeting includes a small watermark.
*   **Firebase Integration**: Stores greeting data and uploaded images.
*   **Google Gemini API**: Powers Text-to-Speech (gemini-2.5-flash-preview-tts), Live API for microphone input (gemini-2.5-flash-native-audio-preview-09-2025), and Video Generation (veo-3.1-fast-generate-preview).

## Technology Stack

*   **Frontend**: React.js with TypeScript
*   **Styling**: Tailwind CSS
*   **AI**: Google Gemini API (`@google/genai` SDK)
*   **Backend/Database**: Firebase (Firestore for data, Storage for images)
*   **Build Tool**: Vite

## Setup and Local Development

### 1. Clone the repository

```bash
git clone <repository-url>
cd e-Greetz
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Google Gemini API Key

You need a Google Gemini API key to use this application.

*   Go to [Google AI Studio](https://aistudio.google.com/) or [Google Cloud Console](https://console.cloud.google.com/).
*   Create a new project or select an existing one.
*   Enable the Gemini API.
*   Generate an API key.

**Important**: For video generation models (like `veo-3.1-fast-generate-preview`), you *must* select an API key from a **paid Google Cloud Project** with billing enabled. The application will prompt you to select an API key if one is not detected, or if the current one does not support the required features.

Create a `.env` file in the root directory of your project and add your Gemini API key:

```
API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
```

Vite is configured to expose `process.env.API_KEY` to the client-side bundle.

### 4. Firebase Configuration

e-Greetz uses Firebase for storing greeting data and uploaded images.

1.  **Create a Firebase Project**:
    *   Go to the [Firebase Console](https://console.firebase.google.com/).
    *   Click "Add project" and follow the steps.

2.  **Set up Firestore Database**:
    *   In your Firebase project, navigate to "Firestore Database" and click "Create database".
    *   Choose "Start in production mode" (you can adjust security rules later) and select a location.
    *   **Security Rules**: For local development, you might relax rules temporarily. For production, set strict rules.
        For `greetings` collection:
        ```
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /greetings/{document=**} {
              allow read, write: if request.auth != null; // Authenticated users only
            }
          }
        }
        ```
        Or for simpler public access during testing:
        ```
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /greetings/{document=**} {
              allow read, write: if true; // WARNING: PUBLIC ACCESS! Not recommended for production.
            }
          }
        }
        ```

3.  **Set up Cloud Storage**:
    *   In your Firebase project, navigate to "Storage" and click "Get started".
    *   Follow the steps to set up a default bucket.
    *   **CORS Configuration for Storage**: This is critical for preventing "Blocked by CORS policy" errors when uploading files. You must configure your storage bucket to allow requests from your Render domain and local development server.
        *   **Install Google Cloud SDK**: If you don't have `gsutil` installed, follow instructions at [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install).
        *   **Authenticate `gsutil`**: Run `gcloud auth login` in your terminal.
        *   **Create `cors.json`**: Create a file named `cors.json` in your project's root with content like this (replace `egreetz.onrender.com` with your actual Render URL):
            ```json
            [
              {
                "origin": ["https://egreetz.onrender.com", "http://localhost:3000"],
                "method": ["GET", "POST", "PUT", "DELETE"],
                "responseHeader": ["Content-Type", "Firebase-Storage-Resumable-Upload-Protocol"],
                "maxAgeSeconds": 3600
              }
            ]
            ```
        *   **Get your Storage Bucket Name**: Find this in Firebase Console -> Storage (e.g., `your-project-id.appspot.com`).
        *   **Apply CORS policy**: In your terminal, run (replace with your bucket name):
            ```bash
            gsutil cors set cors.json gs://your-project-id.appspot.com
            ```
    *   **Security Rules**: For `images` storage:
        ```
        rules_version = '2';
        service firebase.storage {
          match /b/{bucket}/o {
            match /images/{allPaths=**} {
              allow read, write: if request.auth != null; // Authenticated users only
            }
          }
        }
        ```
        Or for simpler public access during testing:
        ```
        rules_version = '2';
        service firebase.storage {
          match /b/{bucket}/o {
            match /{allPaths=**} {
              allow read, write: if true; // WARNING: PUBLIC ACCESS! Not recommended for production.
            }
          }
        }
        ```

4.  **Get Firebase Configuration**:
    *   In your Firebase project, go to "Project settings" (the gear icon).
    *   Under "Your apps," click on "Web" (`</>`) to add a web app. Register your app.
    *   Copy the `firebaseConfig` object.

5.  **Update `services/firebaseService.ts`**:
    *   Open `src/services/firebaseService.ts`.
    *   Replace the placeholder `firebaseConfig` object with your actual Firebase configuration:

    ```typescript
    const firebaseConfig = {
      apiKey: "YOUR_FIREBASE_API_KEY",
      authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
      projectId: "YOUR_FIREBASE_PROJECT_ID",
      storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
      messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
      appId: "YOUR_FIREBASE_APP_ID"
    };
    ```

### 5. Run the application locally

```bash
npm run dev
# or
yarn dev
```

The application will open in your browser, usually at `http://localhost:3000`.

## Deployment to Render.com

Render is a unified platform to build and run all your apps and websites. For this application, you will deploy it as a **Web Service** on Render, which will run a Node.js process to serve your Vite-built static files.

### 1. Prepare your project for deployment

*   Ensure your `package.json` has the necessary scripts:
    *   `"build": "tsc && vite build"` (already present)
    *   `"start": "vite preview"` (already present in `vite.config.ts`, but ensure your `package.json` reflects this if `start` is used in a custom way). For Render, `npm run preview` is directly used.
*   Make sure your `vite.config.ts` correctly handles `process.env.API_KEY` and allows the Render host (which is already configured).

### 2. Create a Render account

If you don't have one, sign up at [Render.com](https://render.com/).

### 3. Connect your Git repository

1.  In your Render dashboard, click "New" -> "Web Service".
2.  Connect your GitHub/GitLab account and select the repository where your e-Greetz code is hosted.

### 4. Configure the Web Service

Fill in the service details. This is where you tell Render how to build and run your application:

*   **Name**: `e-greetz` (or your preferred name)
*   **Region**: Choose a region close to your users.
*   **Branch**: `main` (or your deployment branch)
*   **Root Directory**: `/` (A single forward slash). **This is crucial!** It tells Render that your `package.json` is in the root of your repository, not a subdirectory.
*   **Runtime**: `Node`
*   **Build Command**: `npm install && npm run build` (or `yarn install && yarn run build`). This command installs dependencies and then builds your React application into the `dist` folder.
*   **Start Command**: `npm run preview`. This command starts the Vite preview server, which efficiently serves the static files from your `dist` directory.

### 5. Add Environment Variables

In the "Environment" section of your Render service settings, add the following:

*   **Key**: `API_KEY`
*   **Value**: Your Google Gemini API key (e.g., `AIzaSy...`)

This is crucial for the application to interact with the Gemini API in the deployed environment.

### 6. Deploy

Click "Create Web Service". Render will now clone your repository, install dependencies, build the project, and deploy it. You can monitor the deployment logs in the Render dashboard.

Once deployed, Render will provide a public URL for your e-Greetz application!

## How to use the app:

1.  **Select an Occasion**: Choose the type of greeting from the dropdown.
2.  **Type or Record Message**: Enter your message in the text area. You can also click "Record Message" to speak your message, and the app will transcribe it directly into the text area.
3.  **Upload Image (Optional)**: Click "Upload Image" to add a personal touch.
4.  **Select Voice**: Choose the gender and specific voice type for the greeting's audio.
5.  **Generate Greeting**: Click "Generate Greeting."
    *   The app will first generate the audio using Text-to-Speech.
    *   Then, it will generate a cinematic video based on the occasion and optionally incorporate your uploaded image. Video generation can take several minutes.
    *   A modal might appear if a paid API key is required for video generation.
6.  **View and Play**: Once generated, your new greeting will appear in the "Your Created Greetings" list below the form. You can play the audio or video.
7.  **Delete Greeting**: Each greeting card has a delete button (trash icon) to remove it from your list.
8.  **Refresh/Restart**: The "Refresh/Restart" button clears the form to start a new greeting.

Enjoy creating your personalized e-Greetz!
