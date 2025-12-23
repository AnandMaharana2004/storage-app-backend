# API Endpoints Documentation

## Base URL

`http://localhost:{PORT}` or your production URL

---

## 🔐 Authentication Endpoints (`/auth`)

### 1. Login

- **Method:** `POST`
- **Path:** `/auth/login`
- **Authentication:** Not required
- **Request Body:**
  ```json
  {
    "email": "string (required)",
    "password": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "string",
      "name": "string",
      "email": "string",
      "picture": "string",
      "role": "string (Admin|Manager|User)"
    },
    "message": "User Login Successfully"
  }
  ```
- **Cookies Set:** `sid` (session ID, HttpOnly, 7 days expiry)
- **Notes:** Limits to 2 sessions per user (deletes oldest if exceeded)

### 2. Register

- **Method:** `POST`
- **Path:** `/auth/register`
- **Authentication:** Not required
- **Request Body:**
  ```json
  {
    "name": "string (required, min 3 chars)",
    "email": "string (required, valid email)",
    "password": "string (required, min 4 chars)",
    "otp": "string (required, 4 digits)"
  }
  ```
- **Response (201):**
  ```json
  {
    "statusCode": 201,
    "data": {
      "email": "string"
    },
    "message": "User Registered Successfully"
  }
  ```
- **Notes:** Creates user and root directory in a transaction. OTP must be valid and verified first.

### 3. Generate OTP

- **Method:** `POST`
- **Path:** `/auth/send-otp`
- **Authentication:** Not required
- **Request Body:**
  ```json
  {
    "email": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": "email@example.com",
    "message": "OTP generate successfully"
  }
  ```
- **Notes:** Sends 4-digit OTP to email. OTP expires in 10 minutes.

### 4. Logout

- **Method:** `POST`
- **Path:** `/auth/logout`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "all": "boolean (optional)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": null,
    "message": "User Logout Successfully" // or "User Logout from all device"
  }
  ```
- **Notes:** If `all: true`, logs out from all devices

### 5. Forgot Password

- **Method:** `POST`
- **Path:** `/auth/forgot-password`
- **Authentication:** Not required
- **Request Body:**
  ```json
  {
    "email": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": null,
    "message": "Password reset link has been sent to your email"
  }
  ```
- **Notes:** Sends password reset link via email. Token expires in 1 hour.

### 6. Reset Password

- **Method:** `GET`
- **Path:** `/auth/reset-password/:token`
- **Authentication:** Not required
- **URL Parameters:** `token` (string from email link)
- **Request Body:**
  ```json
  {
    "password": "string (required, min 4 chars)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": null,
    "message": "Password reset successful. Please login with your new password."
  }
  ```
- **Notes:** Invalidates all user sessions after password reset

### 7. Change Password

- **Method:** `POST`
- **Path:** `/auth/change-password`
- **Authentication:** Not required
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": null,
    "message": "Change Password Under Construction"
  }
  ```
- **Notes:** ⚠️ Not implemented yet

### 8. Login with Google

- **Method:** `POST`
- **Path:** `/auth/google/callback`
- **Authentication:** Not required
- **Request Body:**
  ```json
  {
    "tokenId": "string (required, Google OAuth token)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "string",
      "name": "string",
      "email": "string",
      "picture": "string",
      "role": "string"
    },
    "message": "User login successfully"
  }
  ```
- **Cookies Set:** `sid` (session ID, HttpOnly, 7 days expiry)
- **Notes:** Creates new user if doesn't exist

---

## 👤 User Endpoints (`/users`)

All routes require authentication

### 1. Get All Users

- **Method:** `GET`
- **Path:** `/users/all`
- **Authentication:** Required
- **Query Parameters:**
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "users": [
        {
          "_id": "string",
          "name": "string",
          "email": "string",
          "picture": "string",
          "role": "string",
          "maxStorageInBytes": "number",
          "rootDirId": "string",
          "deleted": "boolean"
        }
      ],
      "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalUsers": 50,
        "limit": 10,
        "hasNextPage": true,
        "hasPrevPage": false
      }
    },
    "message": "Users found successfully"
  }
  ```

### 2. Get Current User

- **Method:** `GET`
- **Path:** `/users/me`
- **Authentication:** Required
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "string",
      "name": "string",
      "email": "string",
      "picture": "string",
      "role": "string",
      "rootDirId": "string",
      "maxStorageInBytes": "number",
      "deleted": "boolean"
    },
    "message": "Current user retrieved successfully"
  }
  ```

### 3. Search Users

- **Method:** `GET`
- **Path:** `/users/search`
- **Authentication:** Required
- **Query Parameters:**
  - `search` (string, required)
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "users": [...],
      "searchQuery": "john",
      "pagination": {
        "currentPage": 1,
        "totalPages": 2,
        "totalUsers": 15,
        "limit": 10,
        "hasNextPage": true,
        "hasPrevPage": false
      }
    },
    "message": "Users search completed successfully"
  }
  ```

### 4. Delete User (Admin Only)

- **Method:** `DELETE`
- **Path:** `/users/delete`
- **Authentication:** Required (Admin role)
- **Request Body:**
  ```json
  {
    "userId": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "string",
      "name": "string",
      "email": "string",
      "deleted": true
    },
    "message": "User deleted successfully"
  }
  ```
- **Notes:** Soft delete (sets `deleted: true`). Admins cannot delete themselves.

### 5. Delete User Sessions

- **Method:** `DELETE`
- **Path:** `/users/sessions`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "userId": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "deletedCount": 3,
      "userId": "string"
    },
    "message": "User sessions deleted successfully"
  }
  ```
- **Notes:** Users can delete their own sessions. Admins can delete any user's sessions.

---

## 📁 Directory Endpoints (`/directory`)

All routes require authentication

### 1. Create Directory

- **Method:** `POST`
- **Path:** `/directory/create`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "name": "string (required)",
    "parentDirId": "string (optional, null for root level)"
  }
  ```
- **Response (201):**
  ```json
  {
    "statusCode": 201,
    "data": {
      "_id": "string",
      "name": "string",
      "userId": "string",
      "parentDirId": "string|null",
      "size": 0,
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    },
    "message": "Directory created successfully"
  }
  ```
- **Notes:** Directory names must be unique within the same parent directory

### 2. Update Directory Name

- **Method:** `PUT`
- **Path:** `/directory/update`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "directoryId": "string (required)",
    "name": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "string",
      "name": "string",
      "userId": "string",
      "parentDirId": "string|null",
      "size": "number",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    },
    "message": "Directory name updated successfully"
  }
  ```
- **Notes:** Cannot rename root directory

### 3. Get Directory Contents

- **Method:** `GET`
- **Path:** `/directory/:directoryId`
- **Authentication:** Required
- **URL Parameters:** `directoryId` (string)
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "directory": {
        "_id": "string",
        "name": "string",
        "size": "number",
        "parentDirId": "string|null",
        "createdAt": "ISO date",
        "updatedAt": "ISO date"
      },
      "subdirectories": [
        {
          "_id": "string",
          "name": "string",
          "size": "number",
          "createdAt": "ISO date",
          "updatedAt": "ISO date"
        }
      ],
      "files": [
        {
          "_id": "string",
          "name": "string",
          "size": "number",
          "extension": "string",
          "isUploading": "boolean",
          "url": "string",
          "createdAt": "ISO date",
          "updatedAt": "ISO date"
        }
      ],
      "breadcrumbs": [
        {
          "_id": "string",
          "name": "string"
        }
      ],
      "stats": {
        "totalSubdirectories": "number",
        "totalFiles": "number",
        "totalSize": "number"
      }
    },
    "message": "Directory retrieved successfully"
  }
  ```

### 4. Delete Directory

- **Method:** `DELETE`
- **Path:** `/directory/delete`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "directoryId": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "deletedDirectoryId": "string"
    },
    "message": "Directory deleted successfully"
  }
  ```
- **Notes:** Recursively deletes all subdirectories and files. Cannot delete root directory.

### 5. Move Directory

- **Method:** `PUT`
- **Path:** `/directory/move`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "directoryId": "string (required)",
    "newParentDirId": "string (optional, null for root level)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "string",
      "name": "string",
      "userId": "string",
      "parentDirId": "string|null",
      "size": "number",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    },
    "message": "Directory moved successfully"
  }
  ```
- **Notes:** Cannot move directory into its own subdirectory. Cannot move root directory.

---

## 📄 File Endpoints (`/files`)

### Public Routes

#### Get Public/Shared File

- **Method:** `GET`
- **Path:** `/files/shared/:fileId`
- **Authentication:** Not required
- **URL Parameters:** `fileId` (string)
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "file": {
        "name": "string",
        "size": "number",
        "extension": "string",
        "createdAt": "ISO date"
      },
      "downloadUrl": "string (CloudFront signed URL)",
      "expiresIn": 3600
    },
    "message": "Public file retrieved successfully"
  }
  ```

### Private Routes (Authentication Required)

#### 1. Request Upload URL

- **Method:** `POST`
- **Path:** `/files/upload/request`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "name": "string (required)",
    "size": "number (required, bytes)",
    "extension": "string (required, e.g., '.jpg', '.pdf')",
    "parentDirId": "string (optional)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "uploadUrl": "string (S3 presigned URL)",
      "fileId": "string",
      "s3Key": "string",
      "expiresIn": 900
    },
    "message": "Upload URL generated successfully"
  }
  ```
- **Notes:** Checks storage quota. Upload URL expires in 15 minutes.

#### 2. Complete Upload

- **Method:** `POST`
- **Path:** `/files/upload/complete`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "fileId": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "file": {
        "_id": "string",
        "name": "string",
        "size": "number",
        "extension": "string",
        "parentDirId": "string|null",
        "createdAt": "ISO date"
      }
    },
    "message": "File uploaded successfully"
  }
  ```
- **Notes:** Verifies file exists in S3 before marking upload complete

#### 3. Get File

- **Method:** `GET`
- **Path:** `/files/:fileId`
- **Authentication:** Required
- **URL Parameters:** `fileId` (string)
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "file": {
        "_id": "string",
        "name": "string",
        "size": "number",
        "extension": "string",
        "createdAt": "ISO date",
        "updatedAt": "ISO date"
      },
      "downloadUrl": "string (CloudFront signed URL)",
      "expiresIn": 3600
    },
    "message": "File retrieved successfully"
  }
  ```

#### 4. Get Files in Directory

- **Method:** `GET`
- **Path:** `/files/directory/:directoryId`
- **Authentication:** Required
- **URL Parameters:** `directoryId` (string, use "root" for root directory)
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "files": [
        {
          "_id": "string",
          "name": "string",
          "size": "number",
          "extension": "string",
          "isUploading": "boolean",
          "createdAt": "ISO date",
          "updatedAt": "ISO date"
        }
      ],
      "count": "number",
      "directoryId": "string|null"
    },
    "message": "Files retrieved successfully"
  }
  ```

#### 5. Rename File

- **Method:** `PATCH`
- **Path:** `/files/rename`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "fileId": "string (required)",
    "newName": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "file": {
        "_id": "string",
        "name": "string",
        "size": "number",
        "extension": "string",
        "parentDirId": "string|null",
        "updatedAt": "ISO date"
      }
    },
    "message": "File renamed successfully"
  }
  ```
- **Notes:** File names must be unique within the same directory

#### 6. Move File

- **Method:** `PATCH`
- **Path:** `/files/move`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "fileId": "string (required)",
    "newParentDirId": "string (optional, null for root)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "file": {
        "_id": "string",
        "name": "string",
        "size": "number",
        "extension": "string",
        "parentDirId": "string|null",
        "updatedAt": "ISO date"
      }
    },
    "message": "File moved successfully"
  }
  ```
- **Notes:** Updates directory sizes for both old and new parent

#### 7. Share File

- **Method:** `POST`
- **Path:** `/files/share`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "fileId": "string (required)",
    "shareType": "string (required, 'public' or 'private')",
    "expiryHours": "number (optional)",
    "sharedWithUserIds": ["string"] // required if shareType is 'private'
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "shareUrl": "string",
      "shareType": "string",
      "expiresAt": "ISO date|null",
      "sharedWith": ["string"]|null,
      "file": {
        "_id": "string",
        "name": "string",
        "size": "number",
        "extension": "string"
      }
    },
    "message": "File shared publicly successfully"
  }
  ```

#### 8. Delete File

- **Method:** `DELETE`
- **Path:** `/files/delete`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "fileId": "string (required)"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "deletedFileId": "string",
      "deletedFileName": "string"
    },
    "message": "File deleted successfully"
  }
  ```
- **Notes:** Deletes file from S3 and invalidates CloudFront cache

---

## 🌐 CDN/CloudFront Endpoints (`/cdn`)

All routes require authentication

### 1. Refresh CloudFront Cookies

- **Method:** `POST`
- **Path:** `/cdn/refresh-token`
- **Authentication:** Required
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": null,
    "message": "Refresh CDN successfully"
  }
  ```
- **Cookies Set:** CloudFront signed cookies for user's directory
- **Notes:** Cookies valid for 60 minutes, domain: `.devzoon.xyz`

---

## 🏥 Health Check

### Server Health

- **Method:** `GET`
- **Path:** `/health`
- **Authentication:** Not required
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": null,
    "message": "Server health is good"
  }
  ```

---

## 📝 Common Response Format

All API responses follow this structure:

```json
{
  "statusCode": "number",
  "data": "object|array|string|null",
  "message": "string",
  "success": "boolean (true for 2xx status codes)"
}
```

## ❌ Error Response Format

```json
{
  "statusCode": "number (4xx or 5xx)",
  "message": "string (error description)",
  "errors": ["array of error details (optional)"],
  "success": false
}
```

## 🔑 Authentication

Most endpoints require authentication via session cookie (`sid`). The cookie is:

- HttpOnly
- Signed
- SameSite (none in production, lax in development)
- Secure (in production)
- Valid for 7 days

Include the `sid` cookie in your requests for authenticated endpoints.

## 📊 Storage Limits

- Default user storage: 1 GB (1,073,741,824 bytes)
- Can be adjusted per user via `maxStorageInBytes` field
- Upload requests check quota before generating presigned URLs

## 🔒 Role-Based Access

- **User**: Standard access
- **Manager**: (Currently same as User)
- **Admin**: Can delete users and manage all user sessions
