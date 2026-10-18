#!/bin/bash

for i in {2..30}; do
    cp "day1front.png" "day${i}front.png"
    echo "Created: day${i}front.png"
done

echo "Copy operation complete!"