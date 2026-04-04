from abc import ABC, abstractmethod


class BaseTask(ABC):

    def run(self, payload):
        try:
            self.validate(payload)
            result = self.execute(payload)
            self.on_success(result)
            return result
        except Exception as e:
            self.on_failure(e)
            raise e

    def validate(self, payload):
        pass

    @abstractmethod
    def execute(self, payload):
        pass

    def on_success(self, result):
        pass

    def on_failure(self, error):
        pass