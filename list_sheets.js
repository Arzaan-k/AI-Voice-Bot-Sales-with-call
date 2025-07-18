import 'dotenv/config';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

(async () => {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
      pageSize: 50,
    });

    console.table(res.data.files);
  } catch (err) {
    console.error('Failed to list spreadsheets:', err.response?.data || err);
    process.exit(1);
  }
})();
