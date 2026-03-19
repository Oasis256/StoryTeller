const Audble = require('../../../server/providers/Audble')
const { expect } = require('chai')

describe('Audble', () => {
  let audble

  beforeEach(() => {
    audble = new Audble()
  })

  describe('extractAsinFromError', () => {
    it('should extract ASIN from audnex future release message', () => {
      const err = { response: { data: { message: 'Release date is in the future for ASIN: B07X123456' } } }
      expect(audble.extractAsinFromError(err)).to.equal('B07X123456')
    })

    it('should return null when message has invalid ASIN', () => {
      const err = { response: { data: { message: 'Release date is in the future for ASIN: XYZ' } } }
      expect(audble.extractAsinFromError(err)).to.equal(null)
    })

    it('should return null when error has no message', () => {
      expect(audble.extractAsinFromError({})).to.equal(null)
    })
  })
})
