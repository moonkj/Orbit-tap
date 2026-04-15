#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# Find and remove duplicate Resources references from root group
project.main_group.children.select { |c|
  c.is_a?(Xcodeproj::Project::Object::PBXFileReference) &&
  c.path&.include?('SwiftSafariExtension/Resources')
}.each { |r| r.remove_from_project; puts "Removed stale root ref: #{r.path}" }

# Verify extension target state
ext_target = project.targets.find { |t| t.name == 'SwiftSafariExtension' }
puts "Extension Sources: #{ext_target.source_build_phase.files.count}"
puts "Extension Resources: #{ext_target.resources_build_phase.files.count}"

project.save
puts "Fixed."
