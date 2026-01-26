# Stripe Payment Gateway Setup (UK/GBP)

## 🎯 Overview
Production-ready Stripe integration with UK pricing in GBP, VAT collection, and full subscription management.

## 📋 Prerequisites
- Stripe account (https://dashboard.stripe.com)
- NEXT_PUBLIC_APP_URL configured in `.env.local`

## 🔧 Step 1: Create Stripe Products

### 1. Go to Stripe Dashboard
Navigate to: https://dashboard.stripe.com/products

### 2. Create "Nexus Pro" Product
- Click **+ Add product**
- **Name**: Nexus Pro
- **Description**: Unlimited boards, cards, and advanced features
- **Pricing model**: Standard pricing

### 3. Add Monthly Price
- **Price**: £9.00
- **Billing period**: Monthly
- **Currency**: GBP
- Click **Add price**
- **Copy the Price ID** (starts with `price_`) - you'll need this!

### 4. Add Yearly Price
- On the same product, click **Add another price**
- **Price**: £90.00
- **Billing period**: Yearly
- **Currency**: GBP
- Click **Add price**
- **Copy the Price ID** (starts with `price_`)

## 🔐 Step 2: Configure Environment Variables

Add to your `.env.local`:

```env
# Stripe Keys (Get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_... # Use sk_live_... for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Use pk_live_... for production

# Stripe Price IDs (from Step 1)
STRIPE_PRO_MONTHLY_PRICE_ID=price_1QSbhJBXoRZ2SuRIK2qhkXYZ
STRIPE_PRO_YEARLY_PRICE_ID=price_1QSbhJBXoRZ2SuRIABcDeFgH

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000 # Use https://yourdomain.com for production

# Stripe Webhook Secret (Step 3)
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 🪝 Step 3: Setup Webhook Endpoint

### 1. Add Webhook Endpoint
Go to: https://dashboard.stripe.com/webhooks

Click **+ Add endpoint**

### 2. Configure Endpoint
- **Endpoint URL**: `https://yourdomain.com/api/webhook/stripe`
  - For local testing: Use ngrok or Stripe CLI
  - For production: Your actual domain
  
- **Events to send**: Select these events:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

### 3. Copy Webhook Secret
- After creating, click **Reveal** under **Signing secret**
- Copy the secret (starts with `whsec_`)
- Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

## 🧪 Step 4: Test with Stripe Test Mode

### Test Card Numbers
Use these in Stripe Checkout (test mode):

| Scenario | Card Number | CVC | Expiry |
|----------|-------------|-----|---------|
| Success | 4242 4242 4242 4242 | Any 3 digits | Any future date |
| Decline | 4000 0000 0000 0002 | Any 3 digits | Any future date |
| 3D Secure | 4000 0025 0000 3155 | Any 3 digits | Any future date |

### Testing Flow
1. Sign in to your app
2. Go to `/billing`
3. Click **Upgrade to Pro**
4. Use test card above
5. Complete checkout
6. Verify webhook received in Stripe Dashboard
7. Check subscription status in `/billing`

## 🌍 Step 5: UK-Specific Configuration

### VAT Collection
The checkout is configured to collect UK VAT numbers:
- Enabled via `tax_id_collection: { enabled: true }`
- Customers can enter their VAT number during checkout
- Stripe automatically validates UK VAT format

### Address Collection
- Full UK billing address collected
- Required for all transactions
- Auto-updates customer record

### Payment Methods
Currently supports:
- Visa, Mastercard, American Express
- UK debit cards
- Google Pay, Apple Pay (automatic)

To add more methods (e.g., Direct Debit), update:
```typescript
payment_method_types: ["card", "bacs_debit"] // Add UK Direct Debit
```

## 📊 Step 6: Production Checklist

### Before Going Live:

- [ ] Switch to **Live mode** in Stripe Dashboard
- [ ] Update API keys to `sk_live_...` and `pk_live_...`
- [ ] Create products/prices in Live mode
- [ ] Update webhook endpoint to production URL
- [ ] Test complete purchase flow in live mode (use real card, refund immediately)
- [ ] Enable Stripe Radar for fraud protection
- [ ] Set up email receipts in Stripe Dashboard
- [ ] Configure tax rates (Settings > Tax rates)
- [ ] Add Terms of Service URL
- [ ] Test webhook endpoint receiving events
- [ ] Verify currency is GBP (not USD)
- [ ] Check billing portal works
- [ ] Test subscription cancellation flow
- [ ] Test failed payment handling

### Monitoring:

1. **Stripe Dashboard**: Monitor payments, subscriptions, disputes
2. **Webhooks**: Check delivery status and retry failed webhooks
3. **Logs**: Review application logs for Stripe errors
4. **Metrics**: Track conversion rates, churn, MRR

## 🔒 Security Best Practices

1. **Never expose Secret Key**: Only use in server-side code
2. **Verify webhook signatures**: Always validate `stripe-signature` header
3. **Use HTTPS**: Required for production webhooks
4. **Idempotency**: All Stripe API calls should use idempotency keys
5. **Customer data**: Never store card details - let Stripe handle it
6. **Test mode**: Separate test and live environments

## 🆘 Troubleshooting

### "No such price" error
- Verify Price IDs in `.env.local` match Stripe Dashboard
- Ensure you're using the same mode (test/live)

### Webhook not receiving events
- Check webhook URL is publicly accessible
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check Stripe Dashboard > Webhooks > Delivery attempts

### Currency mismatch
- Ensure all prices are in GBP
- Check `STRIPE_CONFIG.currency` is set to "gbp"

### Checkout session expires
- Default: 24 hours
- To extend: Add `expires_at` to session creation

## 📞 Support Resources

- **Stripe Docs**: https://stripe.com/docs
- **Stripe Support**: https://support.stripe.com
- **Community**: https://github.com/stripe/stripe-node

## 💰 Pricing Structure

| Plan | Monthly | Yearly | Savings |
|------|---------|--------|---------|
| Free | £0 | £0 | - |
| Pro | £9/month | £90/year | 17% (£18) |

### Pro Plan Features:
- ✅ Unlimited boards
- ✅ Unlimited cards
- ✅ Advanced collaboration
- ✅ Priority support
- ✅ Custom integrations
- ✅ Advanced analytics

---

**Need help?** Check the [Stripe documentation](https://stripe.com/docs) or contact support.
