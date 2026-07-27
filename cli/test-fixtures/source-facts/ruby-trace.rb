module Checkout
  class Processor
    def call(order)
      validated = validator.validate(order)
      audit record: validated
      validated
    end

    def settled?
      @status == :settled
    end

    def ambiguous(order)
      authorize order; capture order
    end

    def assign(order)
      current = order
    end

    def finish(order)
      return order
    end

    def choose(order)
      if order
        order
      else
        nil
      end
    end

    def drain(items)
      while items
        items = nil
      end
    end

    def invoke(callback, order)
      callback.(order)
    end
  end
end
