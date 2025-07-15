import { Handler } from '@netlify/functions';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

// Google Sheets logging functionality for call bookings
class SheetsService {
  private auth: GoogleAuth;
  private spreadsheetId: string;

  
constructor() {
  this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || '1N-1r65Ip2NN_1qtrLlI4-y0pshMiTIBP6hxF0Z2-9d4';

  this.auth = new GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}


  async logCallBooking(entry: any): Promise<void> {
    try {
      if (!this.spreadsheetId) return;

      const authClient = await this.auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: authClient });

      const values = [[
        new Date(entry.timestamp).toISOString(),
        entry.sessionId,
        entry.contactInfo?.name || '',
        entry.contactInfo?.email || '',
        entry.contactInfo?.phone || '',
        entry.contactInfo?.company || '',
        entry.contactInfo?.title || '',
        entry.bookingInfo?.date || '',
        entry.bookingInfo?.time || '',
        entry.bookingInfo?.type || '',
        entry.leadScore?.overall || 0,
        'call_booked',
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Bookings!A:L',
        valueInputOption: 'RAW',
        resource: { values },
      });
    } catch (error) {
      console.error('Failed to log call booking:', error);
    }
  }
}

const sheetsService = new SheetsService();

export const handler: Handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    const { bookingInfo, contactInfo, sessionId } = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!contactInfo?.name || !contactInfo?.email || !bookingInfo?.date || !bookingInfo?.time) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          message: 'Missing required fields: name, email, date, and time are required' 
        }),
      };
    }

    // Log booking to Google Sheets
    await sheetsService.logCallBooking({
      sessionId,
      contactInfo,
      bookingInfo,
      leadScore: { overall: 8 }, // Assume high score for completed bookings
      timestamp: new Date(),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Call booked successfully! You will receive a calendar invitation shortly.' 
      }),
    };
  } catch (error: any) {
    console.error('Book call API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: error.message || 'Failed to book call' 
      }),
    };
  }
};