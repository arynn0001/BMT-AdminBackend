import mongoose from "mongoose";

const { Schema } = mongoose;
const oid = (ref) => ({ type: Schema.Types.ObjectId, ref });
const opts = { timestamps: true, autoIndex: false };

const portDef = {
  name: { type: String, trim: true, default: "" },
  city: { type: String, default: "" },
  country: { type: String, default: "" },
  code: { type: String, default: "" },
};

// Vendor (sirf read ke liye, strict:false taaki vendor ke saare fields aayein)
export const Vendor =
  mongoose.models.Vendor ||
  mongoose.model("Vendor", new Schema({}, { strict: false }));

export const CruiseShip =
  mongoose.models.CruiseShip ||
  mongoose.model(
    "CruiseShip",
    new Schema(
      {
        vendorId: oid("Vendor"),
        shipName: String,
        cruiseLineName: String,
        cruiseType: String,
        vesselType: String,
        imoNumber: String,
        registrationNumber: String,
        passengerCapacity: Number,
        crewCapacity: Number,
        numberOfCabins: Number,
        numberOfDecks: Number,
        yearBuilt: Number,
        yearRefurbished: Number,
        shipLength: Number,
        shipWidth: Number,
        description: String,
        amenities: [String],
        logo: String,
        coverImage: String,
        images: [String],
        videos: [String],
        status: String,
      },
      opts
    )
  );

export const CruiseItinerary =
  mongoose.models.CruiseItinerary ||
  mongoose.model(
    "CruiseItinerary",
    new Schema(
      {
        vendorId: oid("Vendor"),
        shipId: oid("CruiseShip"),
        itineraryName: String,
        itineraryCode: String,
        description: String,
        durationDays: Number,
        durationNights: Number,
        departurePort: portDef,
        arrivalPort: portDef,
        stops: [
          {
            day: Number,
            portName: String,
            city: String,
            country: String,
            portCode: String,
            arrivalTime: String,
            departureTime: String,
            stayDuration: String,
            description: String,
            activities: [String],
          },
        ],
        destinations: [String],
        activities: [String],
        inclusions: [String],
        exclusions: [String],
        coverImage: String,
        images: [String],
        departureDate: Date,
        returnDate: Date,
        status: String,
      },
      opts
    )
  );

export const CruiseSailing =
  mongoose.models.CruiseSailing ||
  mongoose.model(
    "CruiseSailing",
    new Schema(
      {
        vendorId: oid("Vendor"),
        shipId: oid("CruiseShip"),
        itineraryId: oid("CruiseItinerary"),
        sailingCode: String,
        departureDate: Date,
        returnDate: Date,
        departurePort: portDef,
        arrivalPort: portDef,
        bookingOpenDate: Date,
        bookingCloseDate: Date,
        totalCapacity: Number,
        availableCapacity: Number,
        bookingStatus: String,
        status: String,
      },
      opts
    )
  );

export const CruiseCabin =
  mongoose.models.CruiseCabin ||
  mongoose.model(
    "CruiseCabin",
    new Schema(
      {
        vendorId: oid("Vendor"),
        shipId: oid("CruiseShip"),
        cabinName: String,
        cabinNumber: String,
        cabinType: String,
        deckNumber: Number,
        deckName: String,
        maxGuests: Number,
        maxAdults: Number,
        maxChildren: Number,
        bedType: String,
        numberOfBeds: Number,
        cabinSize: Number,
        cabinSizeUnit: String,
        description: String,
        amenities: [String],
        basePrice: Number,
        currency: String,
        coverImage: String,
        images: [String],
        status: String,
        available: Boolean,
      },
      opts
    )
  );

export const CruisePricing =
  mongoose.models.CruisePricing ||
  mongoose.model(
    "CruisePricing",
    new Schema(
      {
        vendorId: oid("Vendor"),
        sailingId: oid("CruiseSailing"),
        shipId: oid("CruiseShip"),
        cabinId: oid("CruiseCabin"),
        currency: String,
        basePrice: Number,
        adultPrice: Number,
        childPrice: Number,
        infantPrice: Number,
        singleSupplement: Number,
        taxPercentage: Number,
        taxAmount: Number,
        portCharges: Number,
        serviceCharges: Number,
        discountAmount: Number,
        finalPrice: Number,
        status: String,
      },
      opts
    )
  );

export const CruiseAvailability =
  mongoose.models.CruiseAvailability ||
  mongoose.model(
    "CruiseAvailability",
    new Schema(
      {
        vendorId: oid("Vendor"),
        sailingId: oid("CruiseSailing"),
        shipId: oid("CruiseShip"),
        cabinId: oid("CruiseCabin"),
        totalInventory: Number,
        availableInventory: Number,
        reservedInventory: Number,
        soldInventory: Number,
        status: String,
      },
      opts
    )
  );

export const CruiseBooking =
  mongoose.models.CruiseBooking ||
  mongoose.model(
    "CruiseBooking",
    new Schema(
      {
        bookingReference: String,
        customerId: oid("User"),
        vendorId: oid("Vendor"),
        sailingId: oid("CruiseSailing"),
        shipId: oid("CruiseShip"),
        cabinId: oid("CruiseCabin"),
        pricingId: oid("CruisePricing"),
        customerName: String,
        customerEmail: String,
        customerPhone: String,
        passengers: [
          {
            firstName: String,
            lastName: String,
            dateOfBirth: Date,
            age: Number,
            gender: String,
            nationality: String,
            passportNumber: String,
            passportExpiryDate: Date,
            email: String,
            phone: String,
          },
        ],
        quantity: Number,
        currency: String,
        baseAmount: Number,
        taxAmount: Number,
        portCharges: Number,
        serviceCharges: Number,
        discountAmount: Number,
        totalAmount: Number,
        paymentStatus: String,
        bookingStatus: String,
        paymentMethod: String,
        paymentId: String,
        paymentOrderId: String,
        specialRequests: String,
        cancellationReason: String,
        cancelledAt: Date,
        confirmedAt: Date,
        completedAt: Date,
        expiresAt: Date,
      },
      opts
    )
  );