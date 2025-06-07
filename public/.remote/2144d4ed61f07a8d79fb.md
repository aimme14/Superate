---
title: health_management
tags:
  - MongoDB
  - Web
  - REST-API
  - Firebase
  - google-cloud
private: false
updated_at: '2025-03-04T11:48:46+09:00'
id: 2144d4ed61f07a8d79fb
organization_url_name: null
slide: false
ignorePublish: false
---
# 🚀Biomedical Document Management at Cloud Level: MongoDB + Firebase for Efficient Storage
### Project in experimental phase (Beta 0.2)

## Lets get started 💡

In the field of biomedical document management, where information is highly sensitive and must be available 24/7, selecting an efficient architecture is not a mere technical exercise, but a strategic challenge. The right combination of databases, development methodologies, and cloud storage defines the success of any system. However, reality imposes restrictions: from managing large volumes of data to optimizing costs without sacrificing performance or availability.

This is where software engineering shines. There is no single predefined solution; rather, the key lies in building an infrastructure that adapts to the client's requirements without incurring unnecessary expenses. In this context, leveraging free instance technologies and highly scalable platforms becomes a competitive differentiator.

*Authentication and cloud storage:* Firebase Authentication for user management and Firebase Storage (Google Cloud) for storage of associated files (images, invoices, PDF reports).
*NoSQL database:* MongoDB, responsible for storing structured information on biomedical equipment, maintenance and activity logs.
*Scalable REST API "backend":* Deployed in Render with an UptimeRobot macro, ensuring continuous availability and optimal response times.
*Optimized interface "frontend":* React-Table of tanstack, components from shadcn and Tailwind CSS, and fluid experience in data visualization and management.

![Dashboard](https://i.ibb.co/qLcdGvpp/dashboard-1.png "dashboard")
![Create CV](https://i.ibb.co/b5ts3ZhN/dashboard-3.png "create-cv")
![Table CV](https://i.ibb.co/ZpVYt7n1/dashboard-2.png "table-cv")

*In this articule of excersice we expoxe somethings stuff interesing, so make yourself comfortable*

## About my solutions

To design an efficient infrastructure that guarantees scalability and cost optimization, we have integrated technologies with free instances without compromising performance. Firebase and MongoDB are the foundation of our storage, with a clear division between structured data and files:

*MongoDB (500MB Free Tier):* We store standard data such as team resumes, maintenance records, and entity relationships. We do not include binary files or blobs, optimizing storage capacity.
*Firebase Storage (1GB Free Tier, 5GB transfer):* Files (images, invoices, documents) are stored in the cloud and dynamically accessed from the frontend, allowing for efficient loading without saturating MongoDB.

🛠️ Modern and Scalable Interface
For data visualization and management on the frontend, we have opted for ShadCN + React-Table, which allows us to:
✅ A modern and aesthetic UI, with components that are easy to scale.
✅ Optimized filters and sorting, improving the user experience.
✅ Modularity and maintainability, key in growing applications.
✅ Deploy on Vercel (Serverless).

🚀 Backend Available 24/7 with Free Instances
Our REST API is deployed in Render SAAS (Software as a Service), combined with UptimeRobot to ensure that the backend never goes to sleep. Thanks to this architecture, we achieve an always-available API without additional costs.

*so, i boried to talk so much, lets with the implementation.*

## Implementation step by step
*First of all, I'll be a little technical so as not to get carried away with redundancies and unnecessary lines.*
*I dont want to talk about dependencies, I think that if you are here you must have some foundations 😉*
*Sorry if this article is a bit short and not very descriptive 😔*

### Structure database (Model entities relationships)
![Model-Entity-Relationships](https://i.ibb.co/Dg5Rc12k/mer.png "MER")

#### Building our backend...
Service storage Firebase
```typescript
//services, controllers, models etc (boried)
//handler to build errors more structured
//Singleton pattern

class StorageService implements IStorage {
  private static instance: StorageService
  private readonly storage: FirebaseStorage
  private constructor() { this.storage = getStorage(firebaseApp) }

  public static getInstance(): StorageService {
    if (!StorageService.instance) { StorageService.instance = new StorageService() }
    return StorageService.instance
  }
  /*---------------> upload <---------------*/
  /**
   * Subir un archivo al almacenamiento de Firebase.
   * @param {Express.Multer.File} file - El archivo a subir.
   * @param {string} path - La ruta del archivo final.
   * @example path podria ser 'users/profile/{username}'
   * @returns {Promise<Result<string>>} La URL del archivo subido.
   */
  async uploadFile(file: Express.Multer.File, path: string): Promise<Result<string>> {
    return handler(async () => {
      const storageRef = this.getReference(path)
      const metadata = buildStorageMetadata(file)
      const upload = await uploadBytes(storageRef, file.buffer, metadata)
      return await getDownloadURL(upload.ref)
    }, 'subir archivo')
  }
```

so, the backend works looks like this: 
![Model-Entity-Relationships](https://i.ibb.co/R4B73r1J/backend.png "MER")

Implement UptimeRobot "route" macro to ensure continuous availability
```typescript
//you need create your account in the web site oficial: https://uptime.com
//so, asociate a route to start the macro (you backend never goes to sleep - without premium)
//remember that you need deploy the backend (in my case in render)
const router = Router()
const getHealth = (req: Request, res: Response) => {
  if (req.params.id) console.log('params inecesaries')
  res.status(200).send('ok')
}
router.get('/health', getHealth)
```

#### Building our frontend...
react-query to optimize the application (avoid unnecessary re-renders)
```typescript
//hooks
export const useQueryUser = (): QueryReact_User => {
  const user = useUserContext()

  // Obtener usuario por ID
  const fetchUserById = <T>(path: UserType, id: string) => useQuery({
    queryKey: QUERY_KEYS.user(path, id),
    queryFn: () => user.getById<T>(path, id),
    select: (data) => data || undefined,
    enabled: Boolean(id)
  })
  return { fetchUserById }
}

/** Hook personalizado para gestionar mutaciones de usuarios */
export const useUserMutation = (path: UserType): CustomMutation_User => {
  const { create, update, delete: deleteUser } = useUserContext()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: object) => await create(path, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users(path) })
  })
  return {
    createUser: createMutation.mutateAsync,
    isLoading: createMutation.isPending
  }
}
```

## Mean while...
You can see something photos of the application
![Model-Entity-Relationships](https://i.ibb.co/jvgrDS6h/cv.png "MER")
![Create CV](https://i.ibb.co/BVnyw6RG/cv2.png "create-cv")
![Table CV](https://i.ibb.co/mCc23Tmz/cv3.png "table-cv")
![Dashboard](https://i.ibb.co/QFyj92cZ/cv4.png "dashboard")

@mitchel2003
thanks.
