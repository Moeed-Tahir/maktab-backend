const Attendance = require("../models/Attendance");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");

const markAttendance = async (req, res) => {
  try {
    const { classId, teacherId, date, records } = req.body;

    if (!classId || !teacherId || !date || !records || !Array.isArray(records)) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required" 
      });
    }

    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({ 
        success: false, 
        message: "Class not found" 
      });
    }

    const teacherExists = await Teacher.findById(teacherId);
    if (!teacherExists) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }

    for (const record of records) {
      if (!record.studentId || !record.status) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid record: ${JSON.stringify(record)}` 
        });
      }

      const studentExists = await Student.findById(record.studentId);
      if (!studentExists) {
        return res.status(404).json({ 
          success: false, 
          message: `Student not found: ${record.studentId}` 
        });
      }
    }

    // FIX: Convert input date to start of day for comparison
    const inputDate = new Date(date);
    const startOfDay = new Date(inputDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(inputDate.setHours(23, 59, 59, 999));

    // Find attendance for the same class on the same day (ignoring time)
    let attendance = await Attendance.findOne({
      classId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    if (attendance) {
      // UPDATE EXISTING
      attendance.records = records;
      attendance.teacherId = teacherId;
      attendance.date = new Date(date); // Keep the original date with time
      await attendance.save();

      return res.status(200).json({ 
        success: true, 
        message: "Attendance updated successfully", 
        data: attendance 
      });
    } else {
      // CREATE NEW
      attendance = await Attendance.create({
        classId,
        teacherId,
        date: new Date(date),
        records,
      });

      return res.status(201).json({ 
        success: true, 
        message: "Attendance marked successfully", 
        data: attendance 
      });
    }
  } catch (error) {
    console.error("Error creating/updating attendance:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

module.exports = {
  markAttendance
};