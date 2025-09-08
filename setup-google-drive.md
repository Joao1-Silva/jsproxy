# Google Drive Setup Instructions

## ✅ Service Account Setup Complete

The backup system is now configured with Service Account authentication using the provided credentials.

### Current Configuration:
- **Service Account**: `jsproxy@corded-pivot-443015-a5.iam.gserviceaccount.com`
- **Credentials File**: `credentials.json` (already created)
- **Authentication**: Service Account (no OAuth2 setup needed)

### Required: Set Google Drive Folder ID

You need to update the folder ID in `api/backup.js`:

1. **Create or find your Google Drive folder**
2. **Get the folder ID from the URL**: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
3. **Update the configuration**:

```javascript
const GOOGLE_DRIVE_CONFIG = {
  folderId: 'YOUR_ACTUAL_FOLDER_ID_HERE', // Replace this
  credentialsPath: path.join(__dirname, '..', 'credentials.json')
};
```

### Important: Share Folder with Service Account

**You must share your Google Drive folder with the service account email:**

1. Open your Google Drive folder
2. Click "Share" 
3. Add this email: `jsproxy@corded-pivot-443015-a5.iam.gserviceaccount.com`
4. Give it "Editor" permissions

## 🚀 Usage

Once setup is complete:

- **Manual backup**: `GET /backup`
- **Test connection**: `GET /backup?test=connection`
- **Automatic backup**: Runs every minute automatically
- **View logs**: Check server console for backup status

## 📁 Files Created

- `data.json` - Local backup file (in project root)
- `data.json` - Google Drive backup file (in specified folder)

## 🔍 Monitoring

The system logs all backup operations to the console with timestamps and status indicators:
- ✅ Success operations
- ❌ Error operations
- 🔄 Process indicators
