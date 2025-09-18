const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const emailjs = require('@emailjs/nodejs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Store OTPs in memory (in production, use a database)
const otpStore = new Map();

// EmailJS configuration (set these in your Render environment variables)
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

// Routes
app.post('/send-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(email, {
      otp,
      expires: Date.now() + 300000, // 5 minutes
      attempts: 0
    });
    
    // Send email using EmailJS
    const templateParams = {
      to_email: email,
      otp: otp,
      from_name: "OTP Verification Service",
      to_name: email.split('@')[0]
    };
    
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

app.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }
    
    const storedData = otpStore.get(email);
    
    if (!storedData) {
      return res.json({ success: false, message: 'No OTP found for this email' });
    }
    
    // Check if OTP has expired
    if (Date.now() > storedData.expires) {
      otpStore.delete(email);
      return res.json({ success: false, message: 'OTP has expired' });
    }
    
    // Check attempt limit
    if (storedData.attempts >= 3) {
      otpStore.delete(email);
      return res.json({ success: false, message: 'Too many attempts. Please request a new OTP' });
    }
    
    // Increment attempt counter
    storedData.attempts++;
    otpStore.set(email, storedData);
    
    // Verify OTP
    if (storedData.otp !== otp) {
      return res.json({ success: false, message: 'Invalid OTP code' });
    }
    
    // OTP is valid
    otpStore.delete(email);
    res.json({ success: true });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});