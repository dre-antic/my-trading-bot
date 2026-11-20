import unittest

from importer import load_orders, total


class ExistingCustomerFormat(unittest.TestCase):
    def test_sample_utf8(self):
        orders = load_orders("sample_utf8.csv")
        self.assertEqual(len(orders), 3)
        self.assertEqual(orders[1]["customer"], "Jones, Smith & Co")
        self.assertEqual(orders[2]["customer"], "Zoë Designs")
        self.assertEqual(total(orders), 1825.49)


if __name__ == "__main__":
    unittest.main()
