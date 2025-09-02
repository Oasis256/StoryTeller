const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')

class ReadingGoalsController {
  constructor() {}

  /**
   * Middleware to validate admin/user permissions
   */
  static middleware(req, res, next) {
    if (!req.user) {
      Logger.error('[ReadingGoalsController] User not authenticated')
      return res.sendStatus(401)
    }

    // Users can only access their own goals, admins can access any
    const requestedUserId = req.params.userId || req.user.id
    if (requestedUserId !== req.user.id && !req.user.isAdminOrUp) {
      Logger.error(`[ReadingGoalsController] User ${req.user.id} attempted to access goals for user ${requestedUserId}`)
      return res.sendStatus(403)
    }

    next()
  }

  /**
   * GET: /api/reading-goals
   * Get all reading goals for current user or specified user
   */
  static async getGoals(req, res) {
    try {
      const userId = req.params.userId || req.user.id
      const { year, active, completed } = req.query

      let goals
      if (year) {
        goals = await Database.readingGoalModel.getGoalsForYear(userId, parseInt(year))
      } else if (active === 'true') {
        goals = await Database.readingGoalModel.getActiveGoalsForUser(userId)
      } else if (completed === 'true') {
        goals = await Database.readingGoalModel.getCompletedGoalsForUser(userId)
      } else {
        goals = await Database.readingGoalModel.findAll({
          where: { userId },
          order: [['createdAt', 'DESC']]
        })
      }

      res.json({
        goals: goals.map((g) => g.toJSON())
      })
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error getting goals:', error)
      res.status(500).json({ error: 'Failed to get reading goals' })
    }
  }

  /**
   * POST: /api/reading-goals
   * Create a new reading goal
   */
  static async createGoal(req, res) {
    try {
      const userId = req.user.id
      const { title, description, type, targetValue, startDate, endDate, extraData } = req.body

      // Validate required fields
      if (!title || !type || !targetValue || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Validate goal type
      const validTypes = ['books', 'minutes', 'pages', 'series', 'genres']
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid goal type' })
      }

      // Validate dates
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (start >= end) {
        return res.status(400).json({ error: 'End date must be after start date' })
      }

      const goal = await Database.readingGoalModel.create({
        userId,
        title,
        description,
        type,
        targetValue: parseInt(targetValue),
        startDate: start,
        endDate: end,
        extraData: extraData || {}
      })

      // Calculate initial progress
      await Database.readingGoalModel.recalculateProgressForUser(userId)

      const createdGoal = await Database.readingGoalModel.findByPk(goal.id)

      Logger.info(`[ReadingGoalsController] Created goal "${title}" for user ${userId}`)

      // Emit socket event
      SocketAuthority.emitter('reading_goal_created', {
        userId,
        goal: createdGoal.toJSON()
      })

      res.status(201).json(createdGoal.toJSON())
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error creating goal:', error)
      res.status(500).json({ error: 'Failed to create reading goal' })
    }
  }

  /**
   * GET: /api/reading-goals/:id
   * Get a specific reading goal
   */
  static async getGoal(req, res) {
    try {
      const { id } = req.params
      const userId = req.user.id

      // Build where clause based on user permissions
      const whereClause = { id }
      if (!req.user.isAdminOrUp) {
        whereClause.userId = userId
      }

      const goal = await Database.readingGoalModel.findOne({
        where: whereClause
      })

      if (!goal) {
        return res.status(404).json({ error: 'Reading goal not found' })
      }

      res.json(goal.toJSON())
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error getting goal:', error)
      res.status(500).json({ error: 'Failed to get reading goal' })
    }
  }

  /**
   * PATCH: /api/reading-goals/:id
   * Update a reading goal
   */
  static async updateGoal(req, res) {
    try {
      const { id } = req.params
      const userId = req.user.id
      const updates = req.body

      // Build where clause based on user permissions
      const whereClause = { id }
      if (!req.user.isAdminOrUp) {
        whereClause.userId = userId
      }

      const goal = await Database.readingGoalModel.findOne({
        where: whereClause
      })

      if (!goal) {
        return res.status(404).json({ error: 'Reading goal not found' })
      }

      // Validate updates
      if (updates.type && !['books', 'minutes', 'pages', 'series', 'genres'].includes(updates.type)) {
        return res.status(400).json({ error: 'Invalid goal type' })
      }

      if (updates.startDate && updates.endDate) {
        const start = new Date(updates.startDate)
        const end = new Date(updates.endDate)
        if (start >= end) {
          return res.status(400).json({ error: 'End date must be after start date' })
        }
      }

      // Update allowed fields
      const allowedFields = ['title', 'description', 'type', 'targetValue', 'startDate', 'endDate', 'isActive', 'extraData']
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          goal[field] = updates[field]
        }
      }

      await goal.save()

      // Recalculate progress if goal type or dates changed
      if (updates.type || updates.startDate || updates.endDate) {
        await Database.readingGoalModel.recalculateProgressForUser(goal.userId)
        await goal.reload()
      }

      Logger.info(`[ReadingGoalsController] Updated goal "${goal.title}" for user ${goal.userId}`)

      // Emit socket event
      SocketAuthority.emitter('reading_goal_updated', {
        userId: goal.userId,
        goal: goal.toJSON()
      })

      res.json(goal.toJSON())
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error updating goal:', error)
      res.status(500).json({ error: 'Failed to update reading goal' })
    }
  }

  /**
   * DELETE: /api/reading-goals/:id
   * Delete a reading goal
   */
  static async deleteGoal(req, res) {
    try {
      const { id } = req.params
      const userId = req.user.id

      // Build where clause based on user permissions
      const whereClause = { id }
      if (!req.user.isAdminOrUp) {
        whereClause.userId = userId
      }

      const goal = await Database.readingGoalModel.findOne({
        where: whereClause
      })

      if (!goal) {
        return res.status(404).json({ error: 'Reading goal not found' })
      }

      const goalData = goal.toJSON()
      await goal.destroy()

      Logger.info(`[ReadingGoalsController] Deleted goal "${goalData.title}" for user ${goalData.userId}`)

      // Emit socket event
      SocketAuthority.emitter('reading_goal_deleted', {
        userId: goalData.userId,
        goalId: id
      })

      res.status(204).send()
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error deleting goal:', error)
      res.status(500).json({ error: 'Failed to delete reading goal' })
    }
  }

  /**
   * POST: /api/reading-goals/:id/progress
   * Manually update goal progress
   */
  static async updateProgress(req, res) {
    try {
      const { id } = req.params
      const { progress } = req.body
      const userId = req.user.id

      if (typeof progress !== 'number' || progress < 0) {
        return res.status(400).json({ error: 'Invalid progress value' })
      }

      // Build where clause based on user permissions
      const whereClause = { id }
      if (!req.user.isAdminOrUp) {
        whereClause.userId = userId
      }

      const goal = await Database.readingGoalModel.findOne({
        where: whereClause
      })

      if (!goal) {
        return res.status(404).json({ error: 'Reading goal not found' })
      }

      const updatedGoal = await Database.readingGoalModel.updateProgress(id, progress)

      Logger.info(`[ReadingGoalsController] Updated progress for goal "${goal.title}" to ${progress}`)

      // Emit socket event
      SocketAuthority.emitter('reading_goal_progress', {
        userId: goal.userId,
        goal: updatedGoal.toJSON()
      })

      res.json(updatedGoal.toJSON())
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error updating progress:', error)
      res.status(500).json({ error: 'Failed to update goal progress' })
    }
  }

  /**
   * POST: /api/reading-goals/recalculate
   * Recalculate progress for all active goals
   */
  static async recalculateProgress(req, res) {
    try {
      const userId = req.user.id

      await Database.readingGoalModel.recalculateProgressForUser(userId)

      const activeGoals = await Database.readingGoalModel.getActiveGoalsForUser(userId)

      Logger.info(`[ReadingGoalsController] Recalculated progress for ${activeGoals.length} goals for user ${userId}`)

      // Emit socket event
      SocketAuthority.emitter('reading_goals_recalculated', {
        userId,
        goals: activeGoals.map((g) => g.toJSON())
      })

      res.json({
        message: 'Progress recalculated',
        goals: activeGoals.map((g) => g.toJSON())
      })
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error recalculating progress:', error)
      res.status(500).json({ error: 'Failed to recalculate progress' })
    }
  }

  /**
   * GET: /api/reading-goals/stats
   * Get reading goal statistics
   */
  static async getStats(req, res) {
    try {
      const userId = req.params.userId || req.user.id

      const stats = await Database.readingGoalModel.getStatsForUser(userId)

      res.json(stats)
    } catch (error) {
      Logger.error('[ReadingGoalsController] Error getting stats:', error)
      res.status(500).json({ error: 'Failed to get reading goal statistics' })
    }
  }

  /**
   * GET: /api/reading-goals/templates
   * Get predefined goal templates
   */
  static getTemplates(req, res) {
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)
    const yearEnd = new Date(currentYear, 11, 31)

    const templates = [
      {
        title: `Read ${currentYear} Challenge`,
        description: `Complete your reading goal for ${currentYear}`,
        type: 'books',
        targetValue: 12,
        startDate: yearStart,
        endDate: yearEnd,
        category: 'Popular'
      },
      {
        title: '52 Books in 52 Weeks',
        description: 'Read one book every week for a year',
        type: 'books',
        targetValue: 52,
        startDate: yearStart,
        endDate: yearEnd,
        category: 'Challenge'
      },
      {
        title: 'Daily Listening Habit',
        description: 'Listen to audiobooks for at least 30 minutes every day',
        type: 'minutes',
        targetValue: 10950, // 30 min * 365 days
        startDate: yearStart,
        endDate: yearEnd,
        category: 'Habit'
      },
      {
        title: 'Genre Explorer',
        description: 'Read books from 5 different genres',
        type: 'genres',
        targetValue: 5,
        startDate: yearStart,
        endDate: yearEnd,
        category: 'Discovery',
        extraData: { allowGenreSelection: true }
      },
      {
        title: 'Series Marathon',
        description: 'Complete 3 book series',
        type: 'series',
        targetValue: 3,
        startDate: yearStart,
        endDate: yearEnd,
        category: 'Series'
      },
      {
        title: 'Weekend Warrior',
        description: 'Listen for 10 hours every weekend',
        type: 'minutes',
        targetValue: 520, // 10 hours * 52 weekends
        startDate: yearStart,
        endDate: yearEnd,
        category: 'Weekend'
      }
    ]

    res.json({ templates })
  }
}

module.exports = ReadingGoalsController
