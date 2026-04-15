#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

ext_target = project.targets.find { |t| t.name == 'SwiftSafariExtension' }
raise "SwiftSafariExtension target not found" unless ext_target

# Clear all existing resource build files
ext_target.resources_build_phase.files.each do |f|
  ext_target.resources_build_phase.remove_build_file(f)
end

# Remove old SwiftSafariExtension group from project
old_ext_group = project.main_group.groups.find { |g| g.name == 'SwiftSafariExtension' }
old_ext_group.remove_from_project if old_ext_group

# Also remove any stale folder refs
project.main_group.children.select { |c| c.path&.include?('SwiftSafariExtension') }.each do |c|
  c.remove_from_project
end

# Create a new group for extension
ext_group = project.main_group.new_group('SwiftSafariExtension', 'SwiftSafariExtension')

# Add SafariWebExtensionHandler.swift as source
handler_ref = ext_group.new_file('SafariWebExtensionHandler.swift')
ext_target.source_build_phase.add_file_reference(handler_ref)

# Add AppGroupConstants.swift to extension build too
shared_group = project.main_group.groups.find { |g| g.name == 'Shared' }
if shared_group
  shared_group.files.each do |file|
    ext_target.source_build_phase.add_file_reference(file)
  end
end

# Add the entire Resources folder as a single folder reference
# This avoids "Multiple commands produce" errors
res_ref = ext_group.new_reference('Resources')
res_ref.last_known_file_type = 'folder'
res_ref.source_tree = '<group>'
ext_target.resources_build_phase.add_file_reference(res_ref)

project.save
puts "Extension resources fixed successfully."
puts "  - SafariWebExtensionHandler.swift → Sources"
puts "  - AppGroupConstants.swift → Sources"
puts "  - Resources/ → folder reference → Resources phase"
