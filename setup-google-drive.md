# Google Drive Setup Instructions

## 🔧 Initial Setup Required

Before the backup system can work, you need to complete the Google Drive OAuth2 setup:

### Step 1: Get Authorization URL
```bash
curl "http://localhost:3000/backup?setup=auth"
```

This will return a Google authorization URL. Visit this URL in your browser.

### Step 2: Authorize Application
1. Visit the authorization URL from Step 1
2. Sign in with your Google account
3. Grant permissions to access Google Drive
4. Copy the authorization code from the response

### Step 3: Exchange Code for Tokens
```bash
curl "http://localhost:3000/backup?setup=token&code=YOUR_AUTHORIZATION_CODE_HERE"
```

This will return a `refresh_token`. Copy this token.

### Step 4: Update Configuration
Edit `api/backup.js` and replace `YOUR_REFRESH_TOKEN_HERE` with the actual refresh token:

```javascript
oauth2Client.setCredentials({
  refresh_token: 'YOUR_ACTUAL_REFRESH_TOKEN_HERE'
});
```

### Step 5: Set Google Drive Folder ID
Replace `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` in `api/backup.js` with your actual folder ID:

```javascript
folderId: 'YOUR_ACTUAL_FOLDER_ID_HERE'
```

To get your folder ID:
1. Open Google Drive in browser
2. Navigate to your desired folder
3. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

## 🚀 Usage

Once setup is complete:

- **Manual backup**: `GET /backup`
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
