# Quick Stripe Setup Guide

## ⚡ Fast Setup (5 minutes)

### Step 1: Get Stripe Test Keys
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy the **Publishable key** (starts with `pk_test_`)
3. Click "Reveal test key" and copy **Secret key** (starts with `sk_test_`)

### Step 2: Create Test Product
1. Go to https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**
3. Name: `Nexus Pro`
4. Add **Monthly price**: £9.00 GBP, Monthly billing
5. **Copy the Price ID** (starts with `price_`)
6. Add **Yearly price**: £90.00 GBP, Yearly billing  
7. **Copy the Price ID** (starts with `price_`)

### Step 3: Update Environment Variables

Add to your `c:\Nexus\nexus\.env.local`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_PRO_MONTHLY_PRICE_ID=price_YOUR_MONTHLY_ID_HERE
STRIPE_PRO_YEARLY_PRICE_ID=price_YOUR_YEARLY_ID_HERE
```

### Step 4: Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### Step 5: Test Payment

1. Go to http://localhost:3000/billing
2. Click "Upgrade to Pro"
3. Use test card: `4242 4242 4242 4242`
4. Any future expiry date, any CVC
5. Complete checkout

## ✅ That's It!

For production setup, see full documentation in `STRIPE_SETUP_UK.md`

## 🆘 Troubleshooting

**"No such price" error?**
- Make sure you copied the Price IDs correctly
- Ensure they start with `price_`
- Check you're in Test mode in Stripe Dashboard

**Still not working?**
- Restart your dev server after adding env vars
- Check `.env.local` file exists in `c:\Nexus\nexus\` folder
- Verify no extra spaces in env variables
