const Timetable = require("../models/TimeTable");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");

const createTimetable = async (req, res) => {
  try {
    const { classId, teacherId, dayOfWeek, startTime, endTime, subject, topic } = req.body;

    if (!classId || !teacherId || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const foundClass = await Class.findById(classId);
    if (!foundClass)
      return res.status(404).json({ message: "Class not found" });

    const foundTeacher = await Teacher.findById(teacherId);
    if (!foundTeacher)
      return res.status(404).json({ message: "Teacher not found" });

    const conflict = await Timetable.findOne({
      teacher: teacherId,
      dayOfWeek,
      startTime,
      endTime,
    });
    if (conflict)
      return res.status(400).json({ message: "Timetable conflict detected" });

    const timetable = new Timetable({
      class: classId,
      teacher: teacherId,
      dayOfWeek,
      startTime,
      endTime,
      subject,
      topic,
    });

    await timetable.save();

    foundTeacher.timetable.push(timetable._id);
    await foundTeacher.save();

    return res.status(201).json({
      message: "Timetable created successfully",
      timetable,
    });
  } catch (error) {
    console.error("Error creating timetable:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteTimeTable = async (req, res) => {
  try {
    const { timetableId } = req.body;

    if (!timetableId) {
      return res.status(400).json({
        message: "Timetable ID is required"
      });
    }

    const timetable = await Timetable.findById(timetableId).populate("teacher");
    if (!timetable) {
      return res.status(404).json({
        message: "Timetable not found"
      });
    }

    const teacher = timetable.teacher;

    if (teacher) {
      teacher.timetable = teacher.timetable.filter(
        timetableId => timetableId.toString() !== timetableId
      );
      await teacher.save();
    }

    await Timetable.findByIdAndDelete(timetableId);

    return res.status(200).json({
      message: "Timetable deleted successfully.",
      deletedTimetableId: timetableId
    });

  } catch (error) {
    console.error("Error deleting timetable:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const getAllTimetables = async (req, res) => {
  try {
    const { studentId, teacherId } = req.body;

    let query = {};

    if (studentId) {
      const student = await Student.findOne({ user: studentId }).populate('class');

      if (!student) {
        return res.status(404).json({
          message: "Student not found"
        });
      }

      if (!student.class) {
        return res.status(200).json({
          message: "Timetables fetched successfully",
          timetables: []
        });
      }

      query.class = student.class._id;
    }
    else if (teacherId) {
      query.teacher = teacherId;
    }

    const timetables = await Timetable.find(query)
      .populate({
        path: "class",
        select: "name code subject",
      })
      .populate({
        path: "teacher",
        select: "fullName email phone",
      })
      .sort({ dayOfWeek: 1, startTime: 1 });

    return res.status(200).json({
      message: "Timetables fetched successfully",
      timetables
    });
  } catch (error) {
    console.error("Error fetching timetables:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const getTimetableById = async (req, res) => {
  try {
    const { timetableId } = req.body;

    if (!timetableId) {
      return res.status(400).json({
        message: "Timetable ID is required"
      });
    }

    const timetable = await Timetable.findById(timetableId)
      .populate({
        path: "class",
        select: "name code subject"
      })
      .populate({
        path: "teacher",
        select: "fullName email phone"
      });

    if (!timetable) {
      return res.status(404).json({
        message: "Timetable not found"
      });
    }

    return res.status(200).json({
      message: "Timetable fetched successfully",
      timetable
    });

  } catch (error) {
    console.error("Error fetching timetable by ID:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const updateTimetableById = async (req, res) => {
  try {
    const { timetableId, classId, teacherId, dayOfWeek, startTime, endTime, subject, topic } = req.body;

    if (!timetableId) {
      return res.status(400).json({
        message: "Timetable ID is required"
      });
    }

    const existingTimetable = await Timetable.findById(timetableId);
    if (!existingTimetable) {
      return res.status(404).json({
        message: "Timetable not found"
      });
    }

    if (classId) {
      const foundClass = await Class.findById(classId);
      if (!foundClass) {
        return res.status(404).json({ message: "Class not found" });
      }
    }

    if (teacherId) {
      const foundTeacher = await Teacher.findById(teacherId);
      if (!foundTeacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }
    }

    if (teacherId && dayOfWeek && startTime && endTime) {
      const conflict = await Timetable.findOne({
        _id: { $ne: timetableId },
        teacher: teacherId,
        dayOfWeek,
        startTime,
        endTime,
      });

      if (conflict) {
        return res.status(400).json({ message: "Timetable conflict detected" });
      }
    }

    const updatedTimetable = await Timetable.findByIdAndUpdate(
      timetableId,
      {
        ...(classId && { class: classId }),
        ...(teacherId && { teacher: teacherId }),
        ...(dayOfWeek && { dayOfWeek }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(subject && { subject }),
        ...(topic && { topic }),
      },
      { new: true, runValidators: true }
    ).populate({
      path: "class",
      select: "name code subject"
    }).populate({
      path: "teacher",
      select: "fullName email phone"
    });

    return res.status(200).json({
      message: "Timetable updated successfully",
      timetable: updatedTimetable
    });

  } catch (error) {
    console.error("Error updating timetable:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

module.exports = {
  createTimetable,
  getAllTimetables,
  deleteTimeTable,
  updateTimetableById,
  getTimetableById
};