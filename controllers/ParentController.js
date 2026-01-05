const bcrypt = require("bcryptjs");
const Parent = require("../models/Parent");
const Student = require("../models/Student");
const User = require("../models/User");
const stripe = require("../utils/stripe");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payments");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const Admin = require("../models/Admin");
const { sendWelcomeEmail } = require("../services/emailServices");

const calculateNextPaymentDate = (frequency) => {
  const date = new Date();
  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  return date;
};

const createParent = async (req, res) => {
  let stripeCustomer;

  try {
    const { adminId, parent: parentData, children } = req.body;

    if (!adminId)
      return res.status(400).json({ message: "adminId is required" });

    const adminExists = await Admin.findById(adminId);
    if (!adminExists)
      return res.status(404).json({ message: "Admin not found" });

    if (!parentData || !children?.length) {
      return res
        .status(400)
        .json({ message: "Parent & at least one child required" });
    }

    const child = children[0];

    const hashedParentPassword = await bcrypt.hash(parentData.password, 10);
    const hashedStudentPassword = await bcrypt.hash(child.password, 10);

    stripeCustomer = await stripe.customers.create({
      name: parentData.fullName,
      email: parentData.email,
      phone: parentData.phone,
      address: { line1: parentData.address },
    });

    await stripe.paymentMethods.attach(parentData.paymentMethodId, {
      customer: stripeCustomer.id,
    });

    const parentUser = await User.create({
      email: parentData.email,
      password: hashedParentPassword,
      role: "Parent",
      createdBy: adminId,
    });

    const studentUser = await User.create({
      email: child.email,
      password: hashedStudentPassword,
      role: "Student",
      createdBy: adminId,
    });

    const parent = await Parent.create({
      ...parentData,
      password: hashedParentPassword,
      user: parentUser._id,
      createdBy: adminId,
      cardDetail: {
        stripeCustomerId: stripeCustomer.id,
        defaultPaymentMethodId: parentData.paymentMethodId,
      },
    });

    const student = await Student.create({
      studentName: child.studentName,
      address: child.address,
      phone: child.phone,
      email: child.email,
      password: hashedStudentPassword,
      classes: [child.class],
      parent: parent._id,
      user: studentUser._id,
      createdBy: adminId,
    });

    parent.students.push(student._id);
    await parent.save();

    await sendWelcomeEmail({
      email: parentData.email,
      role: "Parent",
    });

    return res.status(201).json({
      message: "Parent & Student created successfully",
      parent,
      student,
    });
  } catch (error) {
    if (stripeCustomer) await stripe.customers.del(stripeCustomer.id);
    console.error("❌ createParent:", error);
    return res.status(500).json({ message: error.message });
  }
};

const deleteParent = async (req, res) => {
  try {
    const { parentId } = req.body;

    const parent = await Parent.findById(parentId).populate("students");
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    try {
      if (parent.cardDetail?.stripeCustomerId) {
        await stripe.customers.del(parent.cardDetail.stripeCustomerId);
      }
    } catch (err) {
      console.error("Stripe customer deletion failed:", err.message);
    }

    const studentIds = parent.students.map((s) => s._id);

    await User.deleteMany({ _id: { $in: parent.students.map((s) => s.user) } });

    await Student.deleteMany({ _id: { $in: studentIds } });

    await Payment.deleteMany({
      $or: [{ parent: parent._id }, { student: { $in: studentIds } }],
    });

    await User.findByIdAndDelete(parent.user);

    await Parent.findByIdAndDelete(parentId);

    return res.status(200).json({
      message:
        "Parent and all related students, payments, and user accounts deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting parent:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getAllParents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      adminId,
    } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const searchQuery = search
      ? {
          $or: [
            { fullName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { identityNumber: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const filterQuery = {
      ...searchQuery,
      addToWaitList: false,
      createdBy: adminId,
    };

    const total = await Parent.countDocuments(filterQuery);

    const parents = await Parent.find(filterQuery)
      .populate("students", "studentName email phone class")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .select("-password");

    return res.status(200).json({
      success: true,
      data: parents,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching parents:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllWaitlistParents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      adminId,
    } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const searchQuery = search
      ? {
          $or: [
            { fullName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { identityNumber: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const filterQuery = {
      ...searchQuery,
      addToWaitList: true,
      createdBy: adminId,
    };

    const total = await Parent.countDocuments(filterQuery);

    const waitlistParents = await Parent.find(filterQuery)
      .populate("students", "studentName email phone class")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .select("-password");

    return res.status(200).json({
      success: true,
      data: waitlistParents,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching waitlist parents:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllParentsWithStudents = async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    const parents = await Parent.find({ createdBy: adminId })
      .populate("students", "studentName _id")
      .select("_id fullName");

    return res.status(200).json({
      success: true,
      data: parents,
    });
  } catch (error) {
    console.error("Error fetching parents with students:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getParentById = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing parent ID",
      });
    }

    const parent = await Parent.findById(id)
      .populate("students")
      .select("-password");

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: parent,
    });
  } catch (error) {
    console.error("Error fetching parent by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const addToWaitList = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing parent ID",
      });
    }

    const parent = await Parent.findById(id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    if (parent.addToWaitList) {
      return res.status(400).json({
        success: false,
        message: "Parent is already on waitlist",
      });
    }

    parent.addToWaitList = true;
    await parent.save();

    return res.status(200).json({
      success: true,
      message: "Parent and associated students added to waitlist successfully",
      data: {
        id: parent._id,
        fullName: parent.fullName,
        email: parent.email,
        addToWaitList: parent.addToWaitList,
      },
    });
  } catch (error) {
    console.error("Error adding parent to waitlist:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const removeFromWaitList = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing parent ID",
      });
    }

    const parent = await Parent.findById(id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    if (!parent.addToWaitList) {
      return res.status(400).json({
        success: false,
        message: "Parent is not on waitlist",
      });
    }

    parent.addToWaitList = false;
    await parent.save();

    return res.status(200).json({
      success: true,
      message:
        "Parent and associated students removed from waitlist successfully",
      data: {
        id: parent._id,
        fullName: parent.fullName,
        email: parent.email,
        addToWaitList: parent.addToWaitList,
      },
    });
  } catch (error) {
    console.error("Error removing parent from waitlist:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const processCardPayment = async (req, res) => {
  let paymentIntent;

  try {
    const { amount, selectedDate, paymentMethodId, cardDetails, invoiceId } =
      req.body;

    if (!amount || !selectedDate || !paymentMethodId || !cardDetails) {
      return res.status(400).json({
        message: "Amount, date, payment method, and card details are required",
      });
    }

    const invoice = await Invoice.findById(invoiceId).populate("parent");
    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    const parent = invoice.parent;
    if (!parent) {
      return res.status(404).json({
        message: "Parent not found",
      });
    }

    let stripeCustomerId = parent.cardDetail?.stripeCustomerId;

    if (!stripeCustomerId) {
      try {
        const stripeCustomer = await stripe.customers.create({
          name: parent.fullName,
          email: parent.email,
          phone: parent.phone,
          address: { line1: parent.address },
          metadata: {
            parentId: parent._id.toString(),
            identityNumber: parent.identityNumber,
          },
        });

        stripeCustomerId = stripeCustomer.id;

        await Parent.findByIdAndUpdate(parent._id, {
          "cardDetail.stripeCustomerId": stripeCustomerId,
        });
      } catch (stripeError) {
        console.error("Stripe customer creation error:", stripeError);
        return res.status(400).json({
          message: `Stripe error: ${stripeError.message}`,
        });
      }
    }

    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      await Parent.findByIdAndUpdate(parent._id, {
        "cardDetail.defaultPaymentMethodId": paymentMethodId,
        $push: {
          "cardDetail.paymentMethods": {
            paymentMethodId,
            cardBrand: cardDetails.brand,
            last4: cardDetails.last4,
            expMonth: cardDetails.expMonth,
            expYear: cardDetails.expYear,
            isDefault: true,
          },
        },
      });
    } catch (stripeError) {
      console.error("Stripe payment method error:", stripeError);
      return res.status(400).json({
        message: `Payment method error: ${stripeError.message}`,
      });
    }

    try {
      const baseUrl = "http://localhost:3000";
      const returnUrl = `${baseUrl}/dashboard/finance/invoice/${invoiceId}/payment-done`;

      try {
        new URL(returnUrl);
      } catch (urlError) {
        console.error("Invalid return URL:", returnUrl);
        return res.status(500).json({
          message: "Invalid return URL configuration",
        });
      }

      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100),
        currency: "usd",
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        return_url: returnUrl,
        metadata: {
          parentId: parent._id.toString(),
          invoiceId: invoiceId.toString(),
          parentName: parent.fullName,
          invoiceNumber: invoice.invoiceNumber,
        },
      });

      if (paymentIntent.status === "succeeded") {
        const updatedInvoice = await Invoice.findById(invoiceId);
        if (updatedInvoice) {
          updatedInvoice.status = "paid";
          updatedInvoice.paidAmount = parseFloat(amount);
          updatedInvoice.paidAt = new Date(selectedDate);
          updatedInvoice.paymentMethod =
            parent.cardDetail?.paymentMethods?.[0]?._id || null;
          updatedInvoice.paymentReference = paymentIntent.id;
          updatedInvoice.stripePaymentIntentId = paymentIntent.id;

          await updatedInvoice.save();
        }

        return res.status(200).json({
          message: "Card payment processed successfully",
          payment: {
            id: paymentIntent.id,
            amount: amount,
            status: paymentIntent.status,
            invoiceId: invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            paidAt: new Date(selectedDate),
          },
          parent: {
            id: parent._id,
            fullName: parent.fullName,
            email: parent.email,
            stripeCustomerId: stripeCustomerId,
          },
          invoice: {
            id: invoice._id,
            status: "paid",
            paidAmount: amount,
            paidAt: selectedDate,
          },
        });
      } else if (paymentIntent.status === "requires_action") {
        return res.status(200).json({
          message: "Payment requires additional authentication",
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        });
      } else {
        await Invoice.findByIdAndUpdate(invoiceId, {
          status: "pending",
          paymentReference: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
        });

        return res.status(400).json({
          message: `Payment failed: ${paymentIntent.status}`,
        });
      }
    } catch (paymentError) {
      console.error("Stripe payment processing error:", paymentError);

      await Invoice.findByIdAndUpdate(invoiceId, {
        status: "pending",
        paymentReference: paymentIntent?.id || null,
        stripePaymentIntentId: paymentIntent?.id || null,
      });

      return res.status(400).json({
        message: `Payment processing error: ${paymentError.message}`,
      });
    }
  } catch (error) {
    console.error("❌ Error processing card payment:", error);

    if (paymentIntent && paymentIntent.id) {
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (cancelError) {
        console.error("Error canceling payment intent:", cancelError);
      }
    }

    return res.status(500).json({
      message: error.message,
    });
  }
};

const addCardDetail = async (req, res) => {
  try {
    const { parentId, cardData } = req.body;

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID is required",
      });
    }

    if (!cardData || !cardData.paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Card data with paymentMethodId is required",
      });
    }

    const parent = await mongoose.models.Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    const isFirstCard =
      !parent.cardDetail?.paymentMethods ||
      parent.cardDetail.paymentMethods.length === 0;

    const newCard = {
      paymentMethodId: cardData.paymentMethodId,
      cardBrand: cardData.cardBrand,
      last4: cardData.last4,
      expMonth: cardData.expMonth,
      expYear: cardData.expYear,
      isDefault: isFirstCard || cardData.isDefault || false,
    };

    if (!parent.cardDetail) {
      parent.cardDetail = {
        stripeCustomerId:
          cardData.stripeCustomerId || parent.cardDetail?.stripeCustomerId,
        paymentMethods: [newCard],
      };
    } else {
      if (newCard.isDefault && parent.cardDetail.paymentMethods.length > 0) {
        parent.cardDetail.paymentMethods.forEach((card) => {
          card.isDefault = false;
        });
      }

      parent.cardDetail.paymentMethods.push(newCard);

      if (cardData.stripeCustomerId) {
        parent.cardDetail.stripeCustomerId = cardData.stripeCustomerId;
      }
    }

    await parent.save();

    return res.status(200).json({
      success: true,
      message: "Card added successfully",
      card: newCard,
    });
  } catch (error) {
    console.error("Error adding card detail:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const setCardDefault = async (req, res) => {
  try {
    const { parentId, paymentMethodId } = req.body;
    console.log("Setting default card:", { parentId, paymentMethodId });

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID is required",
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment Method ID is required",
      });
    }

    const parent = await mongoose.models.Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    if (
      !parent.cardDetail ||
      !parent.cardDetail.paymentMethods ||
      parent.cardDetail.paymentMethods.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: "No payment methods found for this parent",
      });
    }

    const cardToSetDefault = parent.cardDetail.paymentMethods.find(
      (card) => card.paymentMethodId === paymentMethodId
    );

    if (!cardToSetDefault) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    parent.cardDetail.paymentMethods.forEach((card) => {
      card.isDefault = false;
    });

    cardToSetDefault.isDefault = true;

    parent.cardDetail.defaultPaymentMethodId = paymentMethodId;

    await parent.save();

    return res.status(200).json({
      success: true,
      message: "Card set as default successfully",
      defaultCard: cardToSetDefault,
    });
  } catch (error) {
    console.error("Error setting card as default:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const removeCardDetail = async (req, res) => {
  try {
    const { parentId, paymentMethodId } = req.body;
    console.log("Removing card:", { parentId, paymentMethodId });

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID is required",
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment Method ID is required",
      });
    }

    const parent = await mongoose.models.Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    if (
      !parent.cardDetail ||
      !parent.cardDetail.paymentMethods ||
      parent.cardDetail.paymentMethods.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: "No payment methods found for this parent",
      });
    }

    const cardToRemove = parent.cardDetail.paymentMethods.find(
      (card) => card.paymentMethodId === paymentMethodId
    );

    if (!cardToRemove) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    const wasDefault = cardToRemove.isDefault;
    const remainingCardsCount = parent.cardDetail.paymentMethods.length - 1;

    parent.cardDetail.paymentMethods = parent.cardDetail.paymentMethods.filter(
      (card) => card.paymentMethodId !== paymentMethodId
    );

    if (wasDefault && remainingCardsCount > 0) {
      parent.cardDetail.paymentMethods[0].isDefault = true;
      parent.cardDetail.defaultPaymentMethodId =
        parent.cardDetail.paymentMethods[0].paymentMethodId;
    } else if (remainingCardsCount === 0) {
      parent.cardDetail.defaultPaymentMethodId = null;
    }

    await parent.save();

    return res.status(200).json({
      success: true,
      message: "Card removed successfully",
      removedCard: cardToRemove,
      remainingCards: parent.cardDetail.paymentMethods.length,
    });
  } catch (error) {
    console.error("Error removing card:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getParentDashboardStats = async (req, res) => {
  try {
    const { parentId } = req.body;

    if (!parentId) {
      return res.status(400).json({ error: "Parent ID is required" });
    }

    const parent = await Parent.findById(parentId)
      .populate({
        path: "students",
        select: "studentName email classes",
        populate: {
          path: "classes",
          select: "className",
        },
      })
      .lean();

    if (!parent) {
      return res.status(404).json({ error: "Parent not found" });
    }

    const studentIds = parent.students.map((student) => student._id);

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const [
      keyMetrics,
      monthlyAttendance,
      feeStats,
      upcomingEvents,
      recentPayments,
      pendingPayments,
      childAttendance,
    ] = await Promise.all([
      getKeyMetrics(parentId, studentIds, currentYear),
      getMonthlyAttendance(studentIds, currentYear),
      getFeeStats(parentId, studentIds),
      getUpcomingEvents(studentIds),
      getRecentPayments(parentId),
      getPendingPayments(parentId),
      getChildAttendanceStats(parent.students),
    ]);

    const dashboardData = {
      keyMetrics,
      monthlyAttendance,
      feeStats,
      upcomingEvents,
      recentPayments,
      pendingPayments,
      childAttendance,
      parentInfo: {
        fullName: parent.fullName,
        email: parent.email,
        children: parent.students.map((student) => ({
          id: student._id,
          name: student.studentName,
          className: student.class?.className || "Not Assigned",
          email: student.email,
        })),
      },
    };

    res.status(200).json(dashboardData);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getKeyMetrics = async (parentId, studentIds, year) => {
  const myChildren = studentIds.length;

  const pendingInvoices = await Invoice.find({
    parent: parentId,
    status: "pending",
  });

  const pendingFees = pendingInvoices.reduce((total, invoice) => {
    return total + (invoice.totalAmount - invoice.paidAmount);
  }, 0);

  const startOfMonth = new Date(year, new Date().getMonth(), 1);
  const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);

  const monthlyAttendance = await Attendance.find({
    date: { $gte: startOfMonth, $lte: endOfMonth },
    "records.studentId": { $in: studentIds },
  });

  let totalRecords = 0;
  let presentRecords = 0;

  monthlyAttendance.forEach((attendance) => {
    attendance.records.forEach((record) => {
      if (studentIds.includes(record.studentId.toString())) {
        totalRecords++;
        if (record.status === "Present") {
          presentRecords++;
        }
      }
    });
  });

  const attendanceRate =
    totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

  const eventsCount = await getEventsCount(studentIds);

  return {
    myChildren,
    pendingFees,
    attendanceRate,
    eventsCount,
  };
};

const getMonthlyAttendance = async (studentIds, year) => {
  const monthlyData = [];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const monthlyAttendance = await Attendance.find({
      date: { $gte: startDate, $lte: endDate },
      "records.studentId": { $in: studentIds },
    });

    let totalRecords = 0;
    let presentRecords = 0;
    let absentRecords = 0;
    let lateRecords = 0;

    monthlyAttendance.forEach((attendance) => {
      attendance.records.forEach((record) => {
        if (studentIds.includes(record.studentId.toString())) {
          totalRecords++;
          if (record.status === "Present") {
            presentRecords++;
          } else if (record.status === "Absent") {
            absentRecords++;
          } else if (record.status === "Late") {
            lateRecords++;
          }
        }
      });
    });

    const presentPercentage =
      totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
    const absentPercentage =
      totalRecords > 0 ? Math.round((absentRecords / totalRecords) * 100) : 0;
    const latePercentage =
      totalRecords > 0 ? Math.round((lateRecords / totalRecords) * 100) : 0;

    monthlyData.push({
      month: months[month],
      present: presentPercentage,
      absent: absentPercentage,
      late: latePercentage,
      actualPresent: presentRecords,
      actualAbsent: absentRecords,
      actualLate: lateRecords,
      total: totalRecords,
    });
  }

  return monthlyData;
};

const getFeeStats = async (parentId, studentIds) => {
  try {
    const successfulPayments = await Payment.find({
      parent: parentId,
      status: "succeeded",
    });

    const totalFeesPaid = successfulPayments.reduce((total, payment) => {
      return total + payment.amount;
    }, 0);

    const pendingInvoices = await Invoice.find({
      parent: parentId,
      status: "pending",
    });

    const pendingFees = pendingInvoices.reduce((total, invoice) => {
      return total + (invoice.totalAmount - (invoice.paidAmount || 0));
    }, 0);

    const upcomingInvoice = await Invoice.findOne({
      parent: parentId,
      status: "pending",
      dueDate: { $gte: new Date() },
    }).sort({ dueDate: 1 });

    const nextDueDate = upcomingInvoice ? upcomingInvoice.dueDate : null;

    return {
      totalFeesPaid,
      pendingFees,
      nextDueDate,
    };
  } catch (error) {
    console.error("Error in getFeeStats:", error);
    return {
      totalFeesPaid: 0,
      pendingFees: 0,
      nextDueDate: null,
    };
  }
};

const getUpcomingEvents = async (studentIds) => {
  try {
    const currentDate = new Date();

    const upcomingEvents = await Event.find({
      date: { $gte: currentDate },
      status: { $in: ["Upcoming", "Ongoing"] },
    })
      .sort({ date: 1, startTime: 1 })
      .limit(5)
      .lean();

    return upcomingEvents.map((event) => ({
      title: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      organizer: event.organizer,
      description: event.description,
      status: event.status,
    }));
  } catch (error) {
    console.error("Error in getUpcomingEvents:", error);
    return [
      {
        title: "Science Fair",
        date: new Date("2025-01-15T10:00:00"),
        description: "Annual science fair exhibition",
      },
    ];
  }
};

const getEventsCount = async (studentIds) => {
  try {
    const currentDate = new Date();

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const eventsCount = await Event.countDocuments({
      date: {
        $gte: currentDate,
        $lte: thirtyDaysFromNow,
      },
      status: { $in: ["Upcoming", "Ongoing"] },
    });

    return eventsCount;
  } catch (error) {
    console.error("Error in getEventsCount:", error);
    return 0;
  }
};

const getRecentPayments = async (parentId) => {
  try {
    const recentPayments = await Payment.find({
      parent: parentId,
      status: "succeeded",
    })
      .populate("student", "studentName")
      .sort({ paymentDate: -1 })
      .limit(4)
      .lean();

    return recentPayments.map((payment) => ({
      childName: payment.student?.studentName || "N/A",
      date: payment.paymentDate
        ? new Date(payment.paymentDate).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "N/A",
      amount: `-$${payment.amount.toLocaleString()}`, // Changed from paidAmount to amount
      color: "text-red-500",
      invoiceNumber: payment.invoiceNumber,
    }));
  } catch (error) {
    console.error("Error in getRecentPayments:", error);
    return [];
  }
};

const getPendingPayments = async (parentId) => {
  try {
    const pendingPayments = await Invoice.find({
      parent: parentId,
      status: "pending",
    })
      .populate("student", "studentName")
      .sort({ dueDate: 1 })
      .limit(4)
      .lean();

    return pendingPayments.map((invoice) => ({
      childName: invoice.student?.studentName || "N/A",
      date: invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "N/A",
      amount: `-$${(
        invoice.totalAmount - invoice.paidAmount
      ).toLocaleString()}`,
      color: "text-red-500",
      invoiceNumber: invoice.invoiceNumber,
    }));
  } catch (error) {
    console.error("Error in getPendingPayments:", error);
    return [];
  }
};

const getChildAttendanceStats = async (students) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const studentIds = students.map((student) => student._id);

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const monthlyAttendance = await Attendance.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
      "records.studentId": { $in: studentIds },
    }).lean();

    const childStats = students.map((student) => {
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let totalRecords = 0;

      monthlyAttendance.forEach((attendance) => {
        attendance.records.forEach((record) => {
          if (record.studentId.toString() === student._id.toString()) {
            totalRecords++;
            if (record.status === "Present") {
              presentCount++;
            } else if (record.status === "Absent") {
              absentCount++;
            } else if (record.status === "Late") {
              lateCount++;
            }
          }
        });
      });

      const attendancePercentage =
        totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

      return {
        studentId: student._id,
        studentName: student.studentName,
        className:
          student.class?.className ||
          student.classes?.[0]?.className ||
          "Not Assigned",
        email: student.email,
        attendance: {
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          total: totalRecords,
          percentage: attendancePercentage,
        },
        status:
          attendancePercentage >= 75
            ? "Good"
            : attendancePercentage >= 50
            ? "Average"
            : "Poor",
      };
    });

    return childStats;
  } catch (error) {
    console.error("Error in getChildAttendanceStats:", error);
    return [];
  }
};

const processPendingPayments = async () => {
  const pendingInvoices = await Invoice.find({ status: "pending" });

  if (pendingInvoices.length === 0) {
    return "No pending invoices found";
  }

  for (let invoice of pendingInvoices) {
    try {
      const parent = await Parent.findById(invoice.parent);
      if (!parent) {
        console.log(`Parent not found for invoice ${invoice.invoiceNumber}`);
        continue;
      }

      const defaultCard = parent.cardDetail?.paymentMethods?.find(
        (pm) => pm.isDefault
      );
      if (!defaultCard) {
        console.log(`No default payment method for parent ${parent.fullName}`);
        continue;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(invoice.totalAmount * 100),
        currency: invoice.currency || "USD",
        customer: parent.cardDetail.stripeCustomerId,
        payment_method: defaultCard.paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Invoice #${invoice.invoiceNumber}`,
      });

      await Payment.create({
        parent: parent._id,
        student: invoice.student,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
        currency: invoice.currency,
        stripePaymentIntentId: paymentIntent.id,
        status: paymentIntent.status === "succeeded" ? "succeeded" : "failed",
        paymentMethod: {
          paymentMethodId: defaultCard.paymentMethodId,
          cardBrand: defaultCard.cardBrand,
          last4: defaultCard.last4,
          expMonth: defaultCard.expMonth,
          expYear: defaultCard.expYear,
        },
        description: "Auto payment of pending invoice",
      });

      invoice.status = "paid";
      invoice.paidAmount = invoice.totalAmount;
      invoice.paidAt = new Date();
      await invoice.save();
    } catch (err) {
      console.log(
        `Payment failed for invoice ${invoice.invoiceNumber}: ${err.message}`
      );
    }
  }

  return "All pending invoices processed";
};

const processRecurringPayments = async () => {
  const today = new Date().setHours(0, 0, 0, 0);

  const parents = await Parent.find({
    "recurringPayment.enabled": true,
    "recurringPayment.nextPaymentDate": { $lte: today },
  }).populate("students");

  if (!parents.length) return "No recurring payments scheduled for today";

  for (let parent of parents) {
    const defaultCard = parent.cardDetail?.paymentMethods?.find(
      (pm) => pm.isDefault
    );
    if (!defaultCard) {
      console.log(`No default card for parent: ${parent.fullName}`);
      continue;
    }

    for (let student of parent.students) {
      if (!student.fee || student.fee <= 0) continue;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(student.fee * 100),
          currency: "USD",
          customer: parent.cardDetail.stripeCustomerId,
          payment_method: defaultCard.paymentMethodId,
          off_session: true,
          confirm: true,
          description: `Recurring payment for student ${student.studentName}`,
        });

        await Payment.create({
          parent: parent._id,
          student: student._id,
          amount: student.fee,
          currency: "USD",
          stripePaymentIntentId: paymentIntent.id,
          status: paymentIntent.status === "succeeded" ? "succeeded" : "failed",
          paymentMethod: {
            paymentMethodId: defaultCard.paymentMethodId,
            cardBrand: defaultCard.cardBrand,
            last4: defaultCard.last4,
            expMonth: defaultCard.expMonth,
            expYear: defaultCard.expYear,
          },
          description: `Recurring payment for ${student.studentName}`,
        });

        console.log(
          `Payment successful for ${student.studentName} (${parent.fullName})`
        );
      } catch (err) {
        console.log(
          `Payment failed for ${student.studentName}: ${err.message}`
        );
      }
    }

    let nextDate = new Date(parent.recurringPayment.nextPaymentDate);
    if (parent.recurringPayment.frequency === "weekly")
      nextDate.setDate(nextDate.getDate() + 7);
    else if (parent.recurringPayment.frequency === "monthly")
      nextDate.setMonth(nextDate.getMonth() + 1);
    else if (parent.recurringPayment.frequency === "quarterly")
      nextDate.setMonth(nextDate.getMonth() + 3);

    parent.recurringPayment.nextPaymentDate = nextDate;
    await parent.save();
  }

  return "Recurring payments processed successfully";
};

module.exports = {
  createParent,
  getAllParents,
  getAllWaitlistParents,
  getParentById,
  addToWaitList,
  removeFromWaitList,
  processCardPayment,
  getAllParentsWithStudents,
  addCardDetail,
  setCardDefault,
  removeCardDetail,
  getParentDashboardStats,
  processPendingPayments,
  processRecurringPayments,
  deleteParent,
};
