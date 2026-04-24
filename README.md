#  Telegram Clone – Next.js & Socket.io  

A feature-rich Telegram clone built with **Next.js**, **Socket.io**, and **PWA** support. It features instant messaging, user authentication, group and channel management, and a modern UI with **Tailwind CSS** and **DaisyUI**.


## 🚀 [Live demo](https://telegram-c.vercel.app/)
* Use a VPN, otherwise you will not be able to work with the app properly

## ✨ Features  
-  **Real-time messaging** powered by Socket.io  
-  **User authentication & management**  
-  **Groups & channels** support  
-  **Profile & settings management**  
-  **Channel & group administration**
-  **Progressive Web App (PWA) support** for a seamless experience  

## ⚙️ Built with 
-  **Next.js** 15
-  **Socket.io** for real-time communication
-  **Zustand** for state management
-  **MongoDB & Liara** for data management
-  **Tailwind CSS & DaisyUI** for modern UI design  
-  **PWA support** for an enhanced web experience
- **TypeScript** for Type Safety

## 📦 Deployment

This project consists of two parts that need to be deployed separately:

1. **Socket.IO Server** (Deploy to Render.com or Railway)
   - Located in `server/index.js`
   - Handles real-time messaging and connections
   - Runs on port 3001

2. **Next.js Application** (Deploy to Vercel.com)
   - Main application interface
   - Located in `src/` directory

📖 **For detailed deployment instructions**, see [DEPLOYMENT.md](./DEPLOYMENT.md)

### Quick Start for Deployment

#### 1. Deploy Socket.IO Server to Render.com
```bash
# Use these settings:
Build Command: npm install
Start Command: npm run server
```

#### 2. Deploy Next.js to Vercel.com
```bash
# Use these settings:
Framework Preset: Next.js
Build Command: next build
Output Directory: .next
```

⚠️ **Important**: Make sure to set the `NEXT_PUBLIC_SOCKET_SERVER_URL` environment variable in Vercel to point to your Render.com Socket.IO server URL!
