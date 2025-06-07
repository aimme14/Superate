// IMPORTANTE: El manejador de notificationclick debe estar ANTES de importar Firebase
// para evitar que Firebase sobrescriba nuestro manejador personalizado
const TARGET_URL = 'https://mern-crud-three-lemon.vercel.app/form/solicits';

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || TARGET_URL
  event.waitUntil(clients.openWindow(urlToOpen))
})

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.2/firebase-messaging-compat.js')

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCjKw582WVzAgwxfsYqQsi-2j0wCxtvHAo",
  appId: "1:230825792921:web:31b62b2e4005df4e866f08",
  authDomain: "gestionsalud-2003.firebaseapp.com",
  storageBucket: "gestionsalud-2003.appspot.com",
  messagingSenderId: "230825792921",
  projectId: "gestionsalud-2003",
  measurementId: "G-XBY19E9TQG"
})
const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  try {
    if (payload.data) { //Prioritize the 'data' field over 'notification'
      const notificationData = { ...payload.data, url: payload.data.url || TARGET_URL }
      const notificationTitle = payload.data.title || 'Nueva notificación'
      const notificationOptions = {
        body: payload.data.body || 'Tienes una nueva notificación',
        tag: payload.data.timestamp || Date.now().toString(),
        badge: '/assets/gs_ico.ico',
        icon: '/assets/gs_ico.ico',
        requireInteraction: true,
        data: notificationData,
        actions: [{ action: 'open', title: 'Ver detalles' }],
      }
      return self.registration.showNotification(notificationTitle, notificationOptions)
    }
  } catch (error) { console.error('[firebase-messaging-sw.js] Error al mostrar notificación:', error) }
})