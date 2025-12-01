const Event = require("../models/Event");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Parent = require("../models/Parent");

const NotificationService = require("../services/NotificationServices");

const createEvent = async (req, res) => {
  try {
    console.log("This is Called");
    
    const { name, location, date, startTime, endTime, organizer, phone, description } = req.body;

    if (endTime <= startTime) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    const event = new Event({
      name,
      location,
      date,
      startTime,
      endTime,
      organizer,
      phone,
      description
    });

    await event.save();
    
    try {
      const [students, teachers, parents] = await Promise.all([
        Student.find({}, '_id'),
        Teacher.find({}, '_id'),
        Parent.find({}, '_id')
      ]);
      
      const recipients = [
        ...students.map(s => ({ id: s._id, model: 'Student' })),
        ...teachers.map(t => ({ id: t._id, model: 'Teacher' })),
        ...parents.map(p => ({ id: p._id, model: 'Parent' }))
      ];
      
      await NotificationService.sendEventNotification(event, recipients);
      console.log(`Event notifications sent to ${recipients.length} recipients`);
    } catch (notificationError) {
      console.error("Failed to send event notifications:", notificationError);
    }
    
    res.status(201).json({
      message: "Event created successfully",
      data: event
    });
  } catch (error) {
    console.error("Create Event Error:", error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    res.status(500).json({ message: "Server error" });
  }
};

const getEvents = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "" 
    } = req.body;

    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { organizer: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const events = await Event.find(filter)
      .sort({ date: 1, startTime: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Event.countDocuments(filter);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      limit: parseInt(limit),
      data: events
    });
  } catch (error) {
    console.error("Get Events Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.body; 
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: "Event ID is required" 
      });
    }

    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: "Event not found" 
      });
    }
    
    res.status(200).json({ 
      success: true,
      data: event 
    });
  } catch (error) {
    console.error("Get Event Error:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: "Invalid event ID" 
      });
    }
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { 
      id,
      name, 
      location, 
      date, 
      startTime, 
      endTime, 
      organizer, 
      phone, 
      description,
      status 
    } = req.body;

    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: "Event ID is required" 
      });
    }

    if (endTime && startTime && endTime <= startTime) {
      return res.status(400).json({ 
        success: false,
        message: "End time must be after start time" 
      });
    }

    const updateData = {
      ...(name && { name }),
      ...(location && { location }),
      ...(date && { date }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(organizer && { organizer }),
      ...(phone && { phone }),
      ...(description && { description }),
      ...(status && { status })
    };

    const event = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: "Event not found" 
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event
    });
  } catch (error) {
    console.error("Update Event Error:", error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: errors.join(', ') 
      });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: "Invalid event ID" 
      });
    }
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: "Event ID is required" 
      });
    }

    const event = await Event.findByIdAndDelete(id);
    
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: "Event not found" 
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: "Event deleted successfully" 
    });
  } catch (error) {
    console.error("Delete Event Error:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: "Invalid event ID" 
      });
    }
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent
};